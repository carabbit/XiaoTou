const EnemyState = {
    Invalid: -1,
    //无敌状态
    Unbeatable: 0,
    Running: 1,
    EndPath: 2,
    Dead: 3
};
//保持无敌状态的距离
const UnbeatableDistance = 50;

cc.Class({
    extends: cc.Component,

    properties: {
        enemyFrames: {
            default: [],
            type: cc.SpriteFrame
        },
        bossFrames: {
            default: [],
            type: cc.SpriteFrame
        },
        spriteNode: {
            default: null,
            type: cc.Sprite
        },
        healthProgressBar: {
            default: null,
            type: cc.ProgressBar
        },
        anim: {
            default: null,
            type: cc.Animation
        },
        slowDebuff: {
            default: null,
            type: cc.Node
        },
        audioDead: {
            default: null,
            url: cc.AudioClip
        },
        damagePrefab: {
            default: null,
            type: cc.Prefab
        }
    },

    // use this for initialization
    onLoad: function () {
        //速度
        this.speed = 0;
        //总血量
        this.currentHealthCount = 0;
        //是否BOSS
        this.isBoss = false;
        //护甲
        this.armor = 0;
        /**以上为enemy的自有属性 */

        this.state = EnemyState.Invalid;
        this.node.opacity = 0;
        this.direction = cc.p(0, 0);
        this.currentPathPointCount = 0;
        this.totalHealthCount = 1;
        //被眩晕
        this.beStuned = false;
        //减速
        this.slowRate = 0;
        //位置标签，标签值越大越靠前
        this.positionTag = 0;
    },

    initWithData: function (gameWorld, type, level, pathPoints) {
        this.gameWorld = gameWorld;
        this.type = type;
        if (this.type >= 1000) {
            this.spriteNode.spriteFrame = this.bossFrames[this.type % 1000];
        } else {
            this.spriteNode.spriteFrame = this.enemyFrames[this.type];
        }
        this.pathPoints = pathPoints;
        this.node.position = pathPoints[0];
        cc.loader.loadRes("./config/monster_config", (err, result) => {
            if (err) {
                cc.log(err);
            } else {
                // cc.log("enemy result = " + JSON.stringify(result));
                let config = result["enemy_" + type][level];
                this.speed = config.speed;
                this.currentHealthCount = config.health;
                this.totalHealthCount = config.health;
                if (config.boss !== undefined) {
                    this.isBoss = config.boss > 0;
                }
                if (config.armor !== undefined) {
                    this.armor = config.armor;
                }
                this.setState(EnemyState.Unbeatable);

                this.schedule(this.playAnim, 1);
            }
        });
    },

    playAnim: function () {
        if (this.type >= 1000) {
            this.anim.play("boss_" + (this.type % 1000));
        } else {
            this.anim.play("enemy_" + (this.type));
        }
    },

    update: function (dt) {
        if (this.state === EnemyState.Running || this.state === EnemyState.Unbeatable) {
            let distance = cc.pDistance(this.node.position, this.pathPoints[this.currentPathPointCount]);
            if (distance < 10) {
                this.currentPathPointCount++;
                if (this.currentPathPointCount === this.pathPoints.length) {
                    this.setState(EnemyState.EndPath);
                    return;
                }
                this.direction = cc.pNormalize(cc.pSub(this.pathPoints[this.currentPathPointCount], this.node.position));
            } else if (!this.beStuned) {
                this.node.position = cc.pAdd(this.node.position, cc.pMult(this.direction, this.speed * (1 - this.slowRate) * dt));
            }

            let startDistance = cc.pDistance(this.node.position, this.pathPoints[0]);
            //超过一定距离，无敌状态消失
            if (startDistance > UnbeatableDistance) {
                this.setState(EnemyState.Running);
            }
        }
        if (this.currentHealthCount < this.totalHealthCount) {
            this.healthProgressBar.active = true;
            this.healthProgressBar.progress = this.currentHealthCount / this.totalHealthCount;
        } else {
            this.healthProgressBar.active = false;
        }
        //位置标签 = 当前节点 * 10000 + distance
        if (this.node.position.active === true) {
            this.positionTag = this.currentPathPointCount * 10000 + cc.pDistance(this.node.position, this.pathPoints[this.currentPathPointCount]);
        }
    },
    setState: function (state) {
        if (this.state === state) {
            return;
        }
        switch (state) {
            case EnemyState.Unbeatable:
            case EnemyState.Running:
                this.node.opacity = 255;
                break;
            case EnemyState.Dead:
                cc.audioEngine.playEffect(this.audioDead, false);
                let deadAction = cc.fadeOut(1);
                let deadSequence = cc.sequence(deadAction, cc.callFunc(() => {
                    //cc.log("死了");
                    this.node.destroy();
                }));
                this.node.runAction(deadSequence);
                break;
            case EnemyState.EndPath:
                let endAction = cc.fadeOut(0.5);
                let endSequence = cc.sequence(endAction, cc.callFunc(() => {
                    cc.log("跑了");
                    this.node.destroy();
                }));
                this.node.runAction(endSequence);
                this.gameWorld.detractLife(1);
                break;
            default:
                break;
        }
        this.state = state;
    },

    isLiving: function () {
        if (this.state === EnemyState.Running) {
            return true;
        }
        return false;
    },
    beAttacked: function (bullet) {
        var damage = bullet.damage;
        if (this.beTriggerRate(bullet.stunRate)) {
            cc.log("触发眩晕！");
            this.handleStuned();
        }
        if (this.beTriggerRate(bullet.critRate)) {
            cc.log("触发暴击！");
            damage = damage * 2;
        }

        this.handleDamage(damage, bullet.gainRate);

        //减速代码
        if (bullet.slowRate > 0 && bullet.slowRate >= this.slowRate) {
            this.hanleSlowed(bullet.slowRate);
        }
    },

    handleDamage: function (damage, gainRate) {
        //护甲减少伤害
        if (this.armor > 0) {
            let curDamageRate = this.getCutDamageRateByArmor(this.armor);
            damage = damage * (1 - curDamageRate);
        }
        damage = Math.round(damage);

        if (damage > this.currentHealthCount) {
            damage = this.currentHealthCount;
        }
        this.gainGold(damage * gainRate);
        this.currentHealthCount -= damage;
        if (this.currentHealthCount <= 0) {
            this.currentHealthCount = 0;
            this.setState(EnemyState.Dead);
            this.gainGold(1);
            if (this.isBoss) {
                this.gameWorld.dropGoods();
            }
        }

        this.damageAnimation(damage);
    },

    handleStuned: function () {
        this.unschedule(this.cancelStuned);
        this.beStuned = true;
        this.scheduleOnce(this.cancelStuned, 2);
    },

    cancelStuned: function () {
        this.beStuned = false;
    },

    hanleSlowed: function (rate) {
        this.unschedule(this.cancelSlowed);
        this.slowRate = rate;
        this.scheduleOnce(this.cancelSlowed, 2);
        this.slowDebuff.active = true;
    },

    cancelSlowed: function () {
        this.slowRate = 0;
        this.slowDebuff.active = false;
    },

    beTriggerRate: function (rate) {
        if (rate > 0) {
            var random = Math.random();
            if (random < rate) {
                return true;
            }
        }

        return false;
    },

    getCutDamageRateByArmor: function (armor) {
        if (armor <= 0) {
            return 0;
        }

        let curDamageRate = (armor * 6) / (100 + armor * 6);
        return curDamageRate;
    },

    gainGold: function (gold) {
        this.gameWorld.addGold(Math.floor(gold));
    },

    isDead: function () {
        if (this.state === EnemyState.Dead) {
            return true;
        }
        return false;
    },

    isEndPath: function () {
        if (this.state === EnemyState.EndPath) {
            return true;
        }
        return false;
    },

    damageAnimation: function (num) {
        let damage = cc.instantiate(this.damagePrefab);
        damage.parent = this.node;
        damage.getComponent("Damage").hit(num);
    }
});