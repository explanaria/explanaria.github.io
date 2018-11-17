    function providedFunc(){
        return 0;
    }


	// parametric function code.
	function updateText(){
		document.getElementById("errormessage").innerHTML = "";


		var lhsText = document.getElementById("functionTextLHS").value;
        var rhsText = document.getElementById("functionTextRHS").value;
   
        var totalEquation = lhsText + "-(" + rhsText + ")"; //to solve a=b, solve a-b=0
        totalEquation = totalEquation.replace(/\^/g,"**"); //a^b -> a**b, to use JS's exponent

		objects = [];

		var functionText = ["function providedFunc(x,y,z,time){",
		"return " + totalEquation + ";",
		"}; window.providedFunc = providedFunc;"].join('');
		console.log(functionText);

		var success = false;

		//the great evil.
		try{
			eval(functionText);
			success = true;
		}catch(e){
			console.log("Oh no! Error!");
		}

		//sanity test: no undefineds
		if(success){
            success = false;
			var result = window.providedFunc(0,0,0,0);
			if(result && result.constructor === Number){
                success = true;
               /// if(result === Nan){
                   /// success = false;
                ///}
			}
		}

		if(success && window.providedFunc && typeof(providedFunc) == "function"){

			console.log("Success!");
            //change EXP things... if it was here

			var elems = document.getElementsByClassName("highlight-if-invalid");
			for(var i=0;i<elems.length;i++){
				elems[i].style.color = "";
			}
            updateFancyLatexDisplay();
			document.getElementById("functionTextLHS").style.backgroundColor = "";
            document.getElementById("functionTextRHS").style.backgroundColor = "";


			//three.render();

		}else{
			var elems = document.getElementsByClassName("highlight-if-invalid");
			for(var i=0;i<elems.length;i++){
				elems[i].style.color = "red";
			}
			document.getElementById("functionTextLHS").style.backgroundColor = "rgba(255,0,0,1)";
            document.getElementById("functionTextRHS").style.backgroundColor = "rgba(255,0,0,1)";
		}
	}
