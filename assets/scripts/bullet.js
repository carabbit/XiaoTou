cc.Class({
    extends: cc.Component,

    properties: {},

    // use this for initialization
    onLoad: function () {
        this.direction = cc.p(0, 0);
        this.speed = 600;
    },
    initWithData: function (tower, position, enemyNodeList) {
        this.direction = cc.pNormalize(cc.pSub(position, tower.position));
        this.node.position = cc.pAdd(tower.position, cc.pMult(this.direction, 100));

        let angle = cc.pAngleSigned(this.direction, cc.p(0, 1));
        this.node.rotation = (180 / Math.PI) * angle;
        this.enemyNodeList = enemyNodeList;
        this.damage = tower.getComponent("tower").getDamage();
        //抢钱比例
        this.gainRate = tower.getComponent("tower").getGainRate();
        //眩晕率
        this.stunRate = tower.getComponent("tower").getStunRate();
        //暴击率
        this.critRate = tower.getComponent("tower").getCritRate();
        //减速率
        this.slowRate = tower.getComponent("tower").getSlowRate();
        //范围攻击
        this.areaAtt = tower.getComponent("tower").isAreaAttack();
        //攻击列表
        this.attList = tower.getComponent("tower").getAreaEnemyList();
    },

    update: function (dt) {
        // cc.log("direction " + JSON.stringify(this.direction));
        this.node.position = cc.pAdd(this.node.position, cc.pMult(this.direction, this.speed * dt));

        for (let i = 0; i < this.enemyNodeList.length; i++) {
            let enemy = this.enemyNodeList[i];
            if (enemy.getComponent("enemy").isLiving()) {
                let distance = cc.pDistance(enemy.position, this.node.position);
                if (distance < (enemy.width * 0.5 + this.node.width * 0.5)) {
                    if (this.areaAtt) {
                        this.handleAreaAttack();
                    } else {
                        enemy.getComponent("enemy").beAttacked(this);
                    }
                    this.node.destroy();
                    // cc.log("")
                    break;
                }
            }
        }

        if (this.node.position.x < -960 * 0.5 || this.node.position.x > 960 * 0.5
            || this.node.position.y > 640 * 0.5 || this.node.position.y < -640 * 0.5) {
            this.node.destroy();
            //cc.log("删掉子弹");
        }

    },
    handleAreaAttack: function() {
        for (let i = 0; i < this.attList.length; i++) {
            let enemy = this.attList[i];
            enemy.getComponent("enemy").beAttacked(this);
        }
    }
});
