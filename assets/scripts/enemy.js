const EnemyState = {
    Invalid: -1,
    Running: 1,
    EndPath: 2,
    Dead: 3
};
cc.Class({
    extends: cc.Component,

    properties: {
        spriteFrames: {
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
    },

    // use this for initialization
    onLoad: function () {
        this.state = EnemyState.Invalid;
        this.node.opacity = 0;
        this.direction = cc.p(0, 0);
        this.currentPathPointCount = 0;
        this.currentHealthCount = 0;
        this.totalHealthCount = 1;
        //被眩晕
        this.beStuned = false;
        //减速
        this.slowRate = 0;
    },

    initWithData: function (type, level, pathPoints) {
        //0 - 6
        this.type = type;
        this.spriteNode.spriteFrame = this.spriteFrames[type];
        this.pathPoints = pathPoints;
        this.node.position = pathPoints[0];
        cc.loader.loadRes("./config/monster_config", (err, result)=>{
            if (err){
                cc.log(err);
            } else {
                // cc.log("enemy result = " + JSON.stringify(result));
                let config = result["enemy_" + type][level];
                this.speed = config.speed;
                this.currentHealthCount = config.health;
                this.totalHealthCount = config.health;
                this.setState(EnemyState.Running);

                this.schedule(this.playAnim, 1);
            }
        });

    },
    
    playAnim: function() {
        this.anim.play("enemy_" + (this.type + 1));
    },

    update: function (dt) {
        if (this.state === EnemyState.Running){
            let distance = cc.pDistance(this.node.position, this.pathPoints[this.currentPathPointCount]);
            if (distance < 10){
                this.currentPathPointCount ++;
                if (this.currentPathPointCount === this.pathPoints.length){
                    this.setState(EnemyState.EndPath);
                    return;
                }
                this.direction = cc.pNormalize(cc.pSub(this.pathPoints[this.currentPathPointCount], this.node.position));
            } else if (!this.beStuned) {
                this.node.position = cc.pAdd(this.node.position, cc.pMult(this.direction, this.speed * (1 - this.slowRate) * dt));
            }
        }
        this.healthProgressBar.progress = this.currentHealthCount / this.totalHealthCount;
    },
    setState: function (state) {
        if (this.state === state){
            return;
        }
        switch (state){
            case EnemyState.Running:
                this.node.opacity = 255;
                break;
            case EnemyState.Dead:
                let deadAction = cc.fadeOut(1);
                let deadSequence = cc.sequence(deadAction, cc.callFunc(()=>{
                    //cc.log("死了");
                    this.node.destroy();
                }));
                this.node.runAction(deadSequence);
                break;
            case EnemyState.EndPath:
                let endAction = cc.fadeOut(0.5);
                let endSequence = cc.sequence(endAction, cc.callFunc(()=>{
                    cc.log("跑了");
                    this.node.destroy();
                }));
                this.node.runAction(endSequence);
                this.node.parent.getComponent('level').detractLife(1);
                break;
            default:
                break;
        }
        this.state = state;
    },
    isLiving: function () {
        if (this.state === EnemyState.Running){
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
        if (damage > this.currentHealthCount) {
            damage = this.currentHealthCount;
        }
        this.gainGold(damage * bullet.gainRate);
        this.currentHealthCount -= damage;
        if (this.currentHealthCount <= 0){
            this.currentHealthCount = 0;
            this.setState(EnemyState.Dead);
            this.gainGold(1);
        }
        //减速测试代码
        //this.hanleSlowed(0.5);
    },

    handleStuned: function() {
        this.unschedule(this.cancelStuned);
        this.beStuned = true;
        this.scheduleOnce(this.cancelStuned, 2);
    },

    cancelStuned: function() {
        this.beStuned = false;
    },

    hanleSlowed: function(rate) {
        this.unschedule(this.cancelSlowed);
        this.slowRate = rate;
        this.scheduleOnce(this.cancelSlowed, 2);
    },

    cancelSlowed: function() {
        this.slowRate = 0;
    },

    beTriggerRate: function(rate) {
        if (rate > 0) {
            var random = Math.random();
            if (random < rate) {
                return true;
            }
        }

        return false;
    },

    gainGold: function(gold) {
        this.node.parent.getComponent("level").addGold(Math.floor(gold));
    },

    isDead: function () {
        if (this.state === EnemyState.Dead){
            return true;
        }
        return false;
    },

    isEndPath: function() {
        if (this.state === EnemyState.EndPath){
            return true;
        }
        return false;
    }
});