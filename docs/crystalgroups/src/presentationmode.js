//Type "hide" on a page to hide all the text and only show interactive bits.
let password = 'hide';

let hidden = false;

let style;
function hideText(){
    style = document.createElement('style');
    style.innerHTML = `
      p {
        display:none;
      }
       .alignBottom, .cayleytextpart, .hidewhenpresenting{
        display:none;
        }
    .newchaptercard > * > *{
        display: inherit;
    }
    `;

    document.head.appendChild(style);
    hidden = true;
}
function showText(){
    
    document.head.removeChild(style);
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
