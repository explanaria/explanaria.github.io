let print = console.log;

export class GroupElement{
    constructor(name, permutation){
        this.name = name;
        this.permutation = permutation; //permutation is an object like {1:3,2:4}
        if(permutation.constructor === String){
            this.permutation = this.parsePermutationNotation(permutation);
        }
    }
    parsePermutationNotation(string){
        if(string[0] !== '(' && string[string.length-1] !== ')'){
            throw new ValueError("permutations must start with ( and end with )")
        }
        string = string.substring(1, string.length-1); //remove leading ( and trailing )

        let permutationMap = {};
        let biggestNumber = 1;

        //todo: check for duplicates

        string.split(")(").forEach(orbit => {
            for(let i=0;i<orbit.length;i++){
                biggestNumber = Math.max(biggestNumber, parseInt(orbit[i]))
                permutationMap[parseInt(orbit[i])] = parseInt(orbit[(i+1) % orbit.length]) //this would be =orbit[i+1] but it needs to loop around
            }
        })
        //if any numbers weren't mentioned, like a permutation (23) doesn't mention 1, add them
        for(let i=1;i<biggestNumber;i++){
            if(permutationMap[i] === undefined){
                permutationMap[i] = i;
            }
        }
        return permutationMap
    }
}

export function reduceName(elem, relations){
    //relations is an object of the form {"rfr":"f", "rrr":"", "ff":""}
    if(relations === undefined){
        return elem;
    }
    let elname = elem.name;

    for(let i=0;i<5;i++){ //arbitrary 5 iterations
        Object.keys(relations).forEach( rel => {
                elname = elname.replace(rel, relations[rel])
        });
    }
    return new GroupElement(elname, elem.permutation)
}

export function compose(el1, el2){
    // return xy, which means do y then x
    let x = el1.permutation;
    let y = el2.permutation;
    let composed = {}
    for (let i in y){
        composed[i] = x[y[i]]
    }

    let newName = el1.name + el2.name; // yes i'm representing as contatenation. this doesn't leave room for inverses

    return new GroupElement(newName, composed);
}

export function permutationIsInList(elem, alist){
    let elempermutation = elem.permutation;
    for(let existingelem of alist){
        let match = true
        //check if elempermutation is the same map as permutation
        let permutation = existingelem.permutation;
        for(let value in permutation){
            if(permutation[value] != elempermutation[value]){
                match = false
                break;
            }
        }
        if(match){
            return true;
        }
    }
    //we checked every element, didn't match any of them
    return false
}

export class Group{
    //represents a finite group. give it some generators and it'll compute all the elements
    //assumption: elements have unique names
    constructor(generators, relations=[], sizeOfUnderlyingPermutationGroup=3){
        this.generators = generators;
        this.relations = relations; //mostly just used to simplify names. optional
        this.elements = this.computeAllGroupElements(generators, relations, sizeOfUnderlyingPermutationGroup);

        this.nameLookupTable = {};
        for(let elem of this.elements){
            this.nameLookupTable[elem.name] = elem;
        }
    }
    getElemByName(name){
        if(this.nameLookupTable[name] !== undefined){
            return this.nameLookupTable[name];
        }
        throw new ReferenceError("nothing named" + name + "is in this group!");
    }
    getElementByName(name){
        return this.getElemByName(name)
    }
    isGenerator(elem){
        return this.generators.indexOf(elem) != -1;
    }
    multiply(elem1, elem2){
        if(this.elements.indexOf(elem1) == -1 || this.elements.indexOf(elem2) == -1){
            throw new ReferenceError(elem1, elem2, "aren't in this group!");
        }
        let newelem = compose(elem1, elem2);

        //now figure out which existing element it is. there's gotta be a better way to do this
        for(let elem of this.elements){
            let match = true;
            for(let number in elem.permutation){
                if(elem.permutation[number] != newelem.permutation[number]){
                    match = false;
                    break
                }
            }
            if(match){
                return elem;
            }
        }

        throw new Error("I composed", elem1, elem2, "but got something not in this group!", newelem);
    }
    computeAllGroupElements(generators, relations, sizeOfUnderlyingPermutationGroup=3){

        let groupelements = [new GroupElement("e", "("+sizeOfUnderlyingPermutationGroup+")")] //start with identity

        //add generators in the first step.
        //we keep track of what new elements we find each time through a loop so that once we stop finding new elements,
        //we stop looping.
        
        //also, the identity is placed in groupelements so that e * a generator won't result in a new element with an "e" in the name.
        let newelements = generators.slice()

        while(newelements.length > 0){
            groupelements = groupelements.concat(newelements)
            newelements = []

            for(let el of groupelements){
                // combine each element with all generators
                for(let gen of generators){
                    let newelem = compose(el, gen) 
                    newelem = reduceName(newelem, relations)

                    if(!permutationIsInList(newelem, groupelements) && !permutationIsInList(newelem, newelements)){
                        newelements.push(newelem)
                    }
                }
            }
        }
        return groupelements;
    }
}
