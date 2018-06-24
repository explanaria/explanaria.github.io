/* The base class that everything inherits from. 
	Each thing drawn to the screen is a tree. Domains, such as EXP.Area or EXP.Array are the root nodes,
	EXP.Transformation is currently the only intermediate node, and the leaf nodes are some form of Output such as
	EXP.LineOutput or EXP.PointOutput, or EXP.VectorOutput.

	All of these can be .add()ed to each other to form that tree, and this file defines how it works.
*/

class Node{
	constructor(){}
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
}

class OutputNode{ //more of a java interface, really
	constructor(){}
	evaluateSelf(i, t, x, y, z){}
	onAfterActivation(){}
	_onAdd(){}
}

export default Node;
export {OutputNode};
