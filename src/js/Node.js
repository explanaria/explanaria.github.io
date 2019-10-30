/* The base class that everything inherits from. 
	Each thing drawn to the screen is a tree. Domains, such as EXP.Area or EXP.Array are the root nodes,
	EXP.Transformation is currently the only intermediate node, and the leaf nodes are some form of Output such as
	EXP.LineOutput or EXP.PointOutput, or EXP.VectorOutput.

	All of these can be .add()ed to each other to form that tree, and this file defines how it works.
*/

class Node{
	constructor(){        
		this.children = [];
		this.parent = null;        
    }
	add(thing){
		//chainable so you can a.add(b).add(c) to make a->b->c
		this.children.push(thing);
		thing.parent = this;
		if(thing._onAdd)thing._onAdd();
		return thing;
	}
	_onAdd(){}
	remove(thing){
		var index = this.children.indexOf( thing );
		if ( index !== - 1 ) {
			thing.parent = null;
			this.children.splice( index, 1 );
		}
		return this;
	}
    getTopParent(){ //find the parent of the parent of the... until there's no more parents.
        const MAX_CHAIN = 100;
        let parentCount = 0;
		let root = this;
		while(root !== null && root.parent !== null && parentCount < MAX_CHAIN){
			root = root.parent;
            parentCount+= 1;
		}
		if(parentCount >= MAX_CHAIN)throw new Error("Unable to find top-level parent!");
        return root;
    }
    getDeepestChildren(){ //find all leaf nodes from this node
        //this algorithm can probably be improved
        if(this.children.length == 0)return [this];

        let children = [];
        for(let i=0;i<this.children.length;i++){
            let childsChildren = this.children[i].getDeepestChildren();
            for(let j=0;j<childsChildren.length;j++){
                children.push(childsChildren[j]);
            }
        }
        return children;
    }
    getClosestDomain(){
        /* Find the DomainNode that this Node is being called from.
        Traverse the chain of parents upwards until we find a DomainNode, at which point we return it.
        This allows an output to resize an array to match a domainNode's numCallsPerActivation, for example.

        Note that this returns the MOST RECENT DomainNode ancestor - it's assumed that domainnodes overwrite one another.
        */
        const MAX_CHAIN = 100;
        let parentCount = 0;
		let root = this.parent; //start one level up in case this is a DomainNode already. we don't want that
		while(root !== null && root.parent !== null && !root.isDomainNode && parentCount < MAX_CHAIN){
			root = root.parent;
            parentCount+= 1;
		}
		if(parentCount >= MAX_CHAIN)throw new Error("Unable to find parent!");
        if(root === null || !root.isDomainNode)throw new Error("No DomainNode parent found!");
        return root;
    }

	onAfterActivation(){
		// do nothing
		//but call all children
		for(var i=0;i<this.children.length;i++){
			this.children[i].onAfterActivation();
		}
	}
}

class OutputNode extends Node{ //more of a java interface, really
	constructor(){super();}
	evaluateSelf(i, t, x, y, z){}
	onAfterActivation(){}
	_onAdd(){}
}

class DomainNode extends Node{ //A node that calls other functions over some range.
	constructor(){
        super();
		this.itemDimensions = []; // array to store the number of times this is called per dimension.
        this.numCallsPerActivation = null; // number of times any child node's evaluateSelf() is called
    }
    activate(t){}
}
DomainNode.prototype.isDomainNode = true;

export default Node;
export {OutputNode, DomainNode};
