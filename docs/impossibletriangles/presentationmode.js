//Type "hide" on a page to hide all the text and only show interactive bits.
let password = 'hide';

let hidden = false;
function hideText(){
    document.getElementsByClassName("non3DFooterPart")[0].style.display = "none"
    document.getElementsByClassName("threeDPart")[0].style.width = "100%";
    document.getElementsByClassName("threeDPart")[0].style.height = "100%";
    three.resizeCanvasIfNecessary();
    hidden = true;
}
function showText(){
    document.getElementsByClassName("non3DFooterPart")[0].style.display = ""
    document.getElementsByClassName("threeDPart")[0].style.width = "";
    document.getElementsByClassName("threeDPart")[0].style.height = "";
    three.resizeCanvasIfNecessary();
    hidden = false;
}

let numConsecutiveLetters = 0;
document.addEventListener('keydown', function(e){
    if (e.key === password[numConsecutiveLetters]) {
        numConsecutiveLetters++;
        if(numConsecutiveLetters >= password.length){
            console.log(hidden);
            if(!hidden){
                hideText();
            }else{
                showText();
            }
            numConsecutiveLetters = 0;  
        }
    }else{
        numConsecutiveLetters = 0;
    }
}, false);
