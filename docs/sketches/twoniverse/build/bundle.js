
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.46.4' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/GridSquare.svelte generated by Svelte v3.46.4 */

    const file$2 = "src/GridSquare.svelte";

    // (74:6) {:else}
    function create_else_block_1(ctx) {
    	let t_value = "-" + "";
    	let t;

    	const block = {
    		c: function create() {
    			t = text(t_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(74:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (67:7) {#if hasAValue}
    function create_if_block_5(ctx) {
    	let if_block_anchor;

    	function select_block_type_1(ctx, dirty) {
    		if (/*numbers*/ ctx[0].length == 1) return create_if_block_6;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(67:7) {#if hasAValue}",
    		ctx
    	});

    	return block;
    }

    // (70:7) {:else}
    function create_else_block(ctx) {
    	let span;
    	let t_value = /*numbers*/ ctx[0].join(" = ") + "";
    	let t;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t = text(t_value);
    			attr_dev(span, "class", "multiplenums svelte-135yhi0");
    			add_location(span, file$2, 70, 8, 1264);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*numbers*/ 1 && t_value !== (t_value = /*numbers*/ ctx[0].join(" = ") + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(70:7) {:else}",
    		ctx
    	});

    	return block;
    }

    // (68:7) {#if numbers.length == 1}
    function create_if_block_6(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text(/*numbers*/ ctx[0]);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*numbers*/ 1) set_data_dev(t, /*numbers*/ ctx[0]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(68:7) {#if numbers.length == 1}",
    		ctx
    	});

    	return block;
    }

    // (78:5) {#if shouldShowArrows}
    function create_if_block(ctx) {
    	let t0;
    	let t1;
    	let t2;
    	let if_block3_anchor;
    	let if_block0 = /*coords*/ ctx[1][0] > 1 && /*coords*/ ctx[1][1] > 1 && create_if_block_4(ctx);
    	let if_block1 = /*coords*/ ctx[1][0] < /*gridSize*/ ctx[2][0] && /*coords*/ ctx[1][1] > 1 && create_if_block_3(ctx);
    	let if_block2 = /*coords*/ ctx[1][1] > 1 && /*coords*/ ctx[1][0] > 1 && create_if_block_2(ctx);
    	let if_block3 = /*coords*/ ctx[1][1] < /*gridSize*/ ctx[2][1] && /*coords*/ ctx[1][0] > 1 && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			if (if_block2) if_block2.c();
    			t2 = space();
    			if (if_block3) if_block3.c();
    			if_block3_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t0, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, t1, anchor);
    			if (if_block2) if_block2.m(target, anchor);
    			insert_dev(target, t2, anchor);
    			if (if_block3) if_block3.m(target, anchor);
    			insert_dev(target, if_block3_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*coords*/ ctx[1][0] > 1 && /*coords*/ ctx[1][1] > 1) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_4(ctx);
    					if_block0.c();
    					if_block0.m(t0.parentNode, t0);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*coords*/ ctx[1][0] < /*gridSize*/ ctx[2][0] && /*coords*/ ctx[1][1] > 1) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_3(ctx);
    					if_block1.c();
    					if_block1.m(t1.parentNode, t1);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*coords*/ ctx[1][1] > 1 && /*coords*/ ctx[1][0] > 1) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_2(ctx);
    					if_block2.c();
    					if_block2.m(t2.parentNode, t2);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (/*coords*/ ctx[1][1] < /*gridSize*/ ctx[2][1] && /*coords*/ ctx[1][0] > 1) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block_1(ctx);
    					if_block3.c();
    					if_block3.m(if_block3_anchor.parentNode, if_block3_anchor);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t0);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(t1);
    			if (if_block2) if_block2.d(detaching);
    			if (detaching) detach_dev(t2);
    			if (if_block3) if_block3.d(detaching);
    			if (detaching) detach_dev(if_block3_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(78:5) {#if shouldShowArrows}",
    		ctx
    	});

    	return block;
    }

    // (80:9) {#if coords[0] > 1 && coords[1] > 1}
    function create_if_block_4(ctx) {
    	let button;
    	let t0;
    	let t1_value = /*coords*/ ctx[1][1] + "";
    	let t1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t0 = text("< -");
    			t1 = text(t1_value);
    			attr_dev(button, "class", "leftarrow svelte-135yhi0");
    			add_location(button, file$2, 80, 13, 1480);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t0);
    			append_dev(button, t1);

    			if (!mounted) {
    				dispose = listen_dev(
    					button,
    					"click",
    					function () {
    						if (is_function(/*buttonCallback*/ ctx[3](/*coords*/ ctx[1], [-1, 0]))) /*buttonCallback*/ ctx[3](/*coords*/ ctx[1], [-1, 0]).apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*coords*/ 2 && t1_value !== (t1_value = /*coords*/ ctx[1][1] + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(80:9) {#if coords[0] > 1 && coords[1] > 1}",
    		ctx
    	});

    	return block;
    }

    // (86:9) {#if coords[0] < gridSize[0] && coords[1] > 1}
    function create_if_block_3(ctx) {
    	let button;
    	let t0;
    	let t1_value = /*coords*/ ctx[1][1] + "";
    	let t1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t0 = text("> +");
    			t1 = text(t1_value);
    			attr_dev(button, "class", "rightarrow svelte-135yhi0");
    			add_location(button, file$2, 86, 13, 1691);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t0);
    			append_dev(button, t1);

    			if (!mounted) {
    				dispose = listen_dev(
    					button,
    					"click",
    					function () {
    						if (is_function(/*buttonCallback*/ ctx[3](/*coords*/ ctx[1], [1, 0]))) /*buttonCallback*/ ctx[3](/*coords*/ ctx[1], [1, 0]).apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*coords*/ 2 && t1_value !== (t1_value = /*coords*/ ctx[1][1] + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(86:9) {#if coords[0] < gridSize[0] && coords[1] > 1}",
    		ctx
    	});

    	return block;
    }

    // (93:9) {#if coords[1] > 1 && coords[0] > 1}
    function create_if_block_2(ctx) {
    	let button;
    	let t0;
    	let t1_value = /*coords*/ ctx[1][0] + "";
    	let t1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t0 = text("^ -");
    			t1 = text(t1_value);
    			attr_dev(button, "class", "uparrow svelte-135yhi0");
    			add_location(button, file$2, 93, 13, 1893);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t0);
    			append_dev(button, t1);

    			if (!mounted) {
    				dispose = listen_dev(
    					button,
    					"click",
    					function () {
    						if (is_function(/*buttonCallback*/ ctx[3](/*coords*/ ctx[1], [0, -1]))) /*buttonCallback*/ ctx[3](/*coords*/ ctx[1], [0, -1]).apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*coords*/ 2 && t1_value !== (t1_value = /*coords*/ ctx[1][0] + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(93:9) {#if coords[1] > 1 && coords[0] > 1}",
    		ctx
    	});

    	return block;
    }

    // (99:9) {#if coords[1] < gridSize[1]  && coords[0] > 1}
    function create_if_block_1(ctx) {
    	let button;
    	let t0;
    	let t1_value = /*coords*/ ctx[1][0] + "";
    	let t1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			t0 = text("V +");
    			t1 = text(t1_value);
    			attr_dev(button, "class", "downarrow svelte-135yhi0");
    			add_location(button, file$2, 99, 13, 2100);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t0);
    			append_dev(button, t1);

    			if (!mounted) {
    				dispose = listen_dev(
    					button,
    					"click",
    					function () {
    						if (is_function(/*buttonCallback*/ ctx[3](/*coords*/ ctx[1], [0, 1]))) /*buttonCallback*/ ctx[3](/*coords*/ ctx[1], [0, 1]).apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*coords*/ 2 && t1_value !== (t1_value = /*coords*/ ctx[1][0] + "")) set_data_dev(t1, t1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(99:9) {#if coords[1] < gridSize[1]  && coords[0] > 1}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let span3;
    	let span0;
    	let t0_value = /*coords*/ ctx[1][0] + "";
    	let t0;
    	let t1;
    	let t2_value = /*coords*/ ctx[1][1] + "";
    	let t2;
    	let t3;
    	let t4_value = /*numbers*/ ctx[0][0] + "";
    	let t4;
    	let t5;
    	let span2;
    	let span1;
    	let t6;

    	function select_block_type(ctx, dirty) {
    		if (/*hasAValue*/ ctx[4]) return create_if_block_5;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);
    	let if_block1 = /*shouldShowArrows*/ ctx[5] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			span3 = element("span");
    			span0 = element("span");
    			t0 = text(t0_value);
    			t1 = text(" * ");
    			t2 = text(t2_value);
    			t3 = text(" = ");
    			t4 = text(t4_value);
    			t5 = space();
    			span2 = element("span");
    			span1 = element("span");
    			if_block0.c();
    			t6 = space();
    			if (if_block1) if_block1.c();
    			attr_dev(span0, "class", "tooltip svelte-135yhi0");
    			add_location(span0, file$2, 62, 4, 1034);
    			attr_dev(span1, "class", "centerpart svelte-135yhi0");
    			add_location(span1, file$2, 65, 5, 1141);
    			attr_dev(span2, "class", "numbergrid svelte-135yhi0");
    			add_location(span2, file$2, 64, 4, 1110);
    			add_location(span3, file$2, 60, 0, 1022);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span3, anchor);
    			append_dev(span3, span0);
    			append_dev(span0, t0);
    			append_dev(span0, t1);
    			append_dev(span0, t2);
    			append_dev(span0, t3);
    			append_dev(span0, t4);
    			append_dev(span3, t5);
    			append_dev(span3, span2);
    			append_dev(span2, span1);
    			if_block0.m(span1, null);
    			append_dev(span2, t6);
    			if (if_block1) if_block1.m(span2, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*coords*/ 2 && t0_value !== (t0_value = /*coords*/ ctx[1][0] + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*coords*/ 2 && t2_value !== (t2_value = /*coords*/ ctx[1][1] + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*numbers*/ 1 && t4_value !== (t4_value = /*numbers*/ ctx[0][0] + "")) set_data_dev(t4, t4_value);

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(span1, null);
    				}
    			}

    			if (/*shouldShowArrows*/ ctx[5]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					if_block1.m(span2, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span3);
    			if_block0.d();
    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let shouldShowArrows;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('GridSquare', slots, []);
    	let { numbers = [] } = $$props;
    	let { coords = [0, 0] } = $$props;
    	let { gridSize = [5, 5] } = $$props;

    	let { buttonCallback = (coords, directionVec) => {
    		
    	} } = $$props;

    	function setID() {
    		$$invalidate(0, numbers = [10, 5]);
    	}

    	let hasAValue = false;
    	const writable_props = ['numbers', 'coords', 'gridSize', 'buttonCallback'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<GridSquare> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('numbers' in $$props) $$invalidate(0, numbers = $$props.numbers);
    		if ('coords' in $$props) $$invalidate(1, coords = $$props.coords);
    		if ('gridSize' in $$props) $$invalidate(2, gridSize = $$props.gridSize);
    		if ('buttonCallback' in $$props) $$invalidate(3, buttonCallback = $$props.buttonCallback);
    	};

    	$$self.$capture_state = () => ({
    		numbers,
    		coords,
    		gridSize,
    		buttonCallback,
    		setID,
    		hasAValue,
    		shouldShowArrows
    	});

    	$$self.$inject_state = $$props => {
    		if ('numbers' in $$props) $$invalidate(0, numbers = $$props.numbers);
    		if ('coords' in $$props) $$invalidate(1, coords = $$props.coords);
    		if ('gridSize' in $$props) $$invalidate(2, gridSize = $$props.gridSize);
    		if ('buttonCallback' in $$props) $$invalidate(3, buttonCallback = $$props.buttonCallback);
    		if ('hasAValue' in $$props) $$invalidate(4, hasAValue = $$props.hasAValue);
    		if ('shouldShowArrows' in $$props) $$invalidate(5, shouldShowArrows = $$props.shouldShowArrows);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*numbers*/ 1) {
    			$$invalidate(4, hasAValue = numbers.length > 0);
    		}

    		if ($$self.$$.dirty & /*hasAValue*/ 16) {
    			$$invalidate(5, shouldShowArrows = hasAValue);
    		}
    	};

    	return [numbers, coords, gridSize, buttonCallback, hasAValue, shouldShowArrows];
    }

    class GridSquare extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
    			numbers: 0,
    			coords: 1,
    			gridSize: 2,
    			buttonCallback: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "GridSquare",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get numbers() {
    		throw new Error("<GridSquare>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set numbers(value) {
    		throw new Error("<GridSquare>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get coords() {
    		throw new Error("<GridSquare>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set coords(value) {
    		throw new Error("<GridSquare>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get gridSize() {
    		throw new Error("<GridSquare>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set gridSize(value) {
    		throw new Error("<GridSquare>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get buttonCallback() {
    		throw new Error("<GridSquare>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set buttonCallback(value) {
    		throw new Error("<GridSquare>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/Intro.svelte generated by Svelte v3.46.4 */

    const file$1 = "src/Intro.svelte";

    function create_fragment$1(ctx) {
    	let div;
    	let h1;
    	let t1;
    	let p0;
    	let t3;
    	let p1;
    	let t5;
    	let p2;
    	let t7;
    	let p3;
    	let t8;
    	let b;
    	let t10;
    	let t11;
    	let p4;
    	let t12;
    	let u;
    	let t14;
    	let t15;
    	let p5;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			h1.textContent = "Spider-Math: Into the 2*3=8iverse";
    			t1 = space();
    			p0 = element("p");
    			p0.textContent = "Welcome to the 2*3=8niverse.";
    			t3 = space();
    			p1 = element("p");
    			p1.textContent = "In our universe, multiplication only works in one way. 2*3 is always 6. But why 6 in particular? It's easy to write down other equations like 2+2=5 - they're just not true in the universe we normally work with.";
    			t5 = space();
    			p2 = element("p");
    			p2.textContent = "...but what about other universes? What if there was an 🌌alternate universe🌌 which followed all the same math rules, but where 2*3 was, say, 8 instead of 6? Will everything implode into a puff of contradictions? Or will it somehow stay internally consistent? Let's find out.";
    			t7 = space();
    			p3 = element("p");
    			t8 = text("Below is an ");
    			b = element("b");
    			b.textContent = "alternate-universe multiplication table";
    			t10 = text(", from an alternate universe where the rules of addition and multiplication work the same but 2*3 is 8 instead of 6.");
    			t11 = space();
    			p4 = element("p");
    			t12 = text("In our universe, if you move sideways along a row of a multiplication table, you add the same number repeatedly. That's true because of the ");
    			u = element("u");
    			u.textContent = "distributive property";
    			t14 = text(" in our universe - so if the rules of this alternate universe are the same, we can still use the distributive property to move sideways across rows and up/down across columns.");
    			t15 = space();
    			p5 = element("p");
    			p5.textContent = "Click the arrows to fill in the multiplication table, and you might find some interesting alternate-universe equations along the way.";
    			add_location(h1, file$1, 11, 4, 102);
    			attr_dev(p0, "class", "svelte-f7jo2g");
    			add_location(p0, file$1, 13, 4, 150);
    			attr_dev(p1, "class", "svelte-f7jo2g");
    			add_location(p1, file$1, 15, 4, 191);
    			attr_dev(p2, "class", "svelte-f7jo2g");
    			add_location(p2, file$1, 18, 4, 419);
    			add_location(b, file$1, 20, 19, 723);
    			attr_dev(p3, "class", "svelte-f7jo2g");
    			add_location(p3, file$1, 20, 4, 708);
    			add_location(u, file$1, 22, 147, 1039);
    			attr_dev(p4, "class", "svelte-f7jo2g");
    			add_location(p4, file$1, 22, 4, 896);
    			attr_dev(p5, "class", "svelte-f7jo2g");
    			add_location(p5, file$1, 24, 4, 1252);
    			add_location(div, file$1, 10, 0, 92);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h1);
    			append_dev(div, t1);
    			append_dev(div, p0);
    			append_dev(div, t3);
    			append_dev(div, p1);
    			append_dev(div, t5);
    			append_dev(div, p2);
    			append_dev(div, t7);
    			append_dev(div, p3);
    			append_dev(p3, t8);
    			append_dev(p3, b);
    			append_dev(p3, t10);
    			append_dev(div, t11);
    			append_dev(div, p4);
    			append_dev(p4, t12);
    			append_dev(p4, u);
    			append_dev(p4, t14);
    			append_dev(div, t15);
    			append_dev(div, p5);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Intro', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Intro> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Intro extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Intro",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    function makeGrid(gridSize){
    	for(let i=0;i<gridSize[0];i++){ //might be gridSize[1] here
    		let column = [];
    		for(let i=0;i<gridSize[1];i++){
    			column.push([]);
    		}
    		numbers.push(column);
    	}
    	
        //first row
    	for(let i=0;i<gridSize[0];i++){
    		numbers[i][0] = [i+1];
        }
        //first column
    	for(let i=0;i<gridSize[1];i++){
    		numbers[0][i] = [i+1];
    	}
    	
    }
    function setMultiplicationEntry(numbers, a,b, product){
    	numbers[a-1][b-1]=[product];
    }

    /* src/App.svelte generated by Svelte v3.46.4 */

    const { console: console_1 } = globals;
    const file = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[3] = list[i];
    	child_ctx[5] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	child_ctx[8] = i;
    	return child_ctx;
    }

    // (53:3) {#each column as values, i}
    function create_each_block_1(ctx) {
    	let gridSquare;
    	let gridSquare_numbers_value;

    	const block = {
    		c: function create() {
    			gridSquare = element("gridSquare");
    			attr_dev(gridSquare, "numbers", gridSquare_numbers_value = /*values*/ ctx[6]);
    			attr_dev(gridSquare, "coords", [/*i*/ ctx[8] + 1, /*j*/ ctx[5] + 1]);
    			attr_dev(gridSquare, "buttoncallback", /*buttonClick*/ ctx[2]);
    			attr_dev(gridSquare, "gridsize", /*gridSize*/ ctx[1]);
    			add_location(gridSquare, file, 53, 3, 1587);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, gridSquare, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*numbers*/ 1 && gridSquare_numbers_value !== (gridSquare_numbers_value = /*values*/ ctx[6])) {
    				attr_dev(gridSquare, "numbers", gridSquare_numbers_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(gridSquare);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(53:3) {#each column as values, i}",
    		ctx
    	});

    	return block;
    }

    // (52:1) {#each numbers as column, j}
    function create_each_block(ctx) {
    	let each_1_anchor;
    	let each_value_1 = /*column*/ ctx[3];
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*numbers, buttonClick, gridSize*/ 7) {
    				each_value_1 = /*column*/ ctx[3];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(52:1) {#each numbers as column, j}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let intro;
    	let t;
    	let div;
    	let current;
    	intro = new Intro({ $$inline: true });
    	let each_value = /*numbers*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			create_component(intro.$$.fragment);
    			t = space();
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div, "class", "biggrid svelte-eb2fm3");
    			add_location(div, file, 50, 0, 1501);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(intro, target, anchor);
    			insert_dev(target, t, anchor);
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*numbers, buttonClick, gridSize*/ 7) {
    				each_value = /*numbers*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: function intro$1(local) {
    			if (current) return;
    			transition_in(intro.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(intro.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(intro, detaching);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let gridSize = [5, 5];
    	let numbers = makeGrid(gridSize);
    	setMultiplicationEntry(numbers, 2, 3, 2); //2*3 = 2

    	function buttonClick(sourceCoords, arrowDirection) {
    		//todo: check if sourceCoords[0] and sourceCoords[1] are in bounds
    		let sourceX = sourceCoords[0];

    		let sourceY = sourceCoords[1];
    		let sourceNumbers = numbers[sourceY - 1][sourceX - 1];
    		let targetX = sourceCoords[0] + arrowDirection[0];
    		let targetY = sourceCoords[1] + arrowDirection[1];
    		numbers[targetY - 1][targetX - 1];

    		for (let number of sourceNumbers) {
    			//distributive law time!
    			//if coords are (3,2) and we move in the (1,0) direction, we're adding 2.
    			//if coords are (3,2) and we move in the (0,1) direction, we're adding 3. y is down
    			number += sourceCoords[1] * arrowDirection[0];

    			number += sourceCoords[0] * arrowDirection[1];
    			console.log(number);

    			if (!numbers[targetY - 1][targetX - 1].includes(number)) {
    				numbers[targetY - 1][targetX - 1].push(number);
    			}
    		}

    		$$invalidate(0, numbers);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		GridSquare,
    		Intro,
    		makeGrid,
    		setMultiplicationEntry,
    		gridSize,
    		numbers,
    		buttonClick
    	});

    	$$self.$inject_state = $$props => {
    		if ('gridSize' in $$props) $$invalidate(1, gridSize = $$props.gridSize);
    		if ('numbers' in $$props) $$invalidate(0, numbers = $$props.numbers);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [numbers, gridSize, buttonClick];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map