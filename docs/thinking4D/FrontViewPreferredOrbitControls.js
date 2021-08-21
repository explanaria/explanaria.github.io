
class FrontViewPreferredOrbitControls extends EXP.OrbitControls{
    
        constructor(){
            super(...arguments);
            this._autoRotateSpeed = this.autoRotateSpeed;
            let superUpdate = this.update;

            this.isCallingSuperUpdate = false; //horrible hack
            this.update = function(){
                this._update();
                this.isCallingSuperUpdate = true;
                superUpdate();
                this.isCallingSuperUpdate = false;
            }
        }

        set autoRotateSpeed(n){
            this._autoRotateSpeed = n;
            if(!this.isCallingSuperUpdate){
                this._absAutoRotateSpeed = Math.abs(n);
            }
        }

        get autoRotateSpeed(){
            return this._autoRotateSpeed;
        }
        _update(){
            if(this.getAzimuthalAngle() < -0.3 && this.autoRotateSpeed >= -this._absAutoRotateSpeed){
                 this.autoRotateSpeed -= 0.02;
            }

            if(this.getAzimuthalAngle() > 0.3 && this.autoRotateSpeed <= this._absAutoRotateSpeed){
                this.autoRotateSpeed += 0.02;
            }
        }
}
