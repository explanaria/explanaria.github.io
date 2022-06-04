
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
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

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_empty_stylesheet(node) {
        const style_element = element('style');
        append_stylesheet(get_root_for_style(node), style_element);
        return style_element.sheet;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
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
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    // we need to store the information for multiple documents because a Svelte application could also contain iframes
    // https://github.com/sveltejs/svelte/issues/3624
    const managed_styles = new Map();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_style_information(doc, node) {
        const info = { stylesheet: append_empty_stylesheet(node), rules: {} };
        managed_styles.set(doc, info);
        return info;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = get_root_for_style(node);
        const { stylesheet, rules } = managed_styles.get(doc) || create_style_information(doc, node);
        if (!rules[name]) {
            rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            managed_styles.forEach(info => {
                const { stylesheet } = info;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                info.rules = {};
            });
            managed_styles.clear();
        });
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

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
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
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                started = true;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }
    function create_out_transition(node, fn, params) {
        let config = fn(node, params);
        let running = true;
        let animation_name;
        const group = outros;
        group.r += 1;
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            add_render_callback(() => dispatch(node, false, 'start'));
            loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(0, 1);
                        dispatch(node, false, 'end');
                        if (!--group.r) {
                            // this will result in `end()` being called,
                            // so we don't need to clean up here
                            run_all(group.c);
                        }
                        return false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(1 - t, t);
                    }
                }
                return running;
            });
        }
        if (is_function(config)) {
            wait().then(() => {
                // @ts-ignore
                config = config();
                go();
            });
        }
        else {
            go();
        }
        return {
            end(reset) {
                if (reset && config.tick) {
                    config.tick(1, 0);
                }
                if (running) {
                    if (animation_name)
                        delete_rule(node, animation_name);
                    running = false;
                }
            }
        };
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

    const file$3 = "src/GridSquare.svelte";

    // (72:6) {:else}
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
    		source: "(72:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (65:7) {#if hasAValue}
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
    		source: "(65:7) {#if hasAValue}",
    		ctx
    	});

    	return block;
    }

    // (68:7) {:else}
    function create_else_block(ctx) {
    	let span;
    	let t_value = /*numbers*/ ctx[0].join(" = ") + "";
    	let t;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t = text(t_value);
    			attr_dev(span, "class", "multiplenums svelte-1r102f");
    			add_location(span, file$3, 68, 8, 1216);
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
    		source: "(68:7) {:else}",
    		ctx
    	});

    	return block;
    }

    // (66:7) {#if numbers.length == 1}
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
    		source: "(66:7) {#if numbers.length == 1}",
    		ctx
    	});

    	return block;
    }

    // (76:5) {#if shouldShowArrows}
    function create_if_block$1(ctx) {
    	let t0;
    	let t1;
    	let t2;
    	let if_block3_anchor;
    	let if_block0 = /*coords*/ ctx[1][0] > 1 && /*coords*/ ctx[1][1] > 1 && create_if_block_4(ctx);
    	let if_block1 = /*coords*/ ctx[1][0] < /*gridSize*/ ctx[2][0] && /*coords*/ ctx[1][1] > 1 && create_if_block_3$1(ctx);
    	let if_block2 = /*coords*/ ctx[1][1] > 1 && /*coords*/ ctx[1][0] > 1 && create_if_block_2$1(ctx);
    	let if_block3 = /*coords*/ ctx[1][1] < /*gridSize*/ ctx[2][1] && /*coords*/ ctx[1][0] > 1 && create_if_block_1$1(ctx);

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
    					if_block1 = create_if_block_3$1(ctx);
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
    					if_block2 = create_if_block_2$1(ctx);
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
    					if_block3 = create_if_block_1$1(ctx);
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
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(76:5) {#if shouldShowArrows}",
    		ctx
    	});

    	return block;
    }

    // (78:9) {#if coords[0] > 1 && coords[1] > 1}
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
    			attr_dev(button, "class", "leftarrow svelte-1r102f");
    			add_location(button, file$3, 78, 13, 1432);
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
    		source: "(78:9) {#if coords[0] > 1 && coords[1] > 1}",
    		ctx
    	});

    	return block;
    }

    // (84:9) {#if coords[0] < gridSize[0] && coords[1] > 1}
    function create_if_block_3$1(ctx) {
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
    			attr_dev(button, "class", "rightarrow svelte-1r102f");
    			add_location(button, file$3, 84, 13, 1643);
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
    		id: create_if_block_3$1.name,
    		type: "if",
    		source: "(84:9) {#if coords[0] < gridSize[0] && coords[1] > 1}",
    		ctx
    	});

    	return block;
    }

    // (91:9) {#if coords[1] > 1 && coords[0] > 1}
    function create_if_block_2$1(ctx) {
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
    			attr_dev(button, "class", "uparrow svelte-1r102f");
    			add_location(button, file$3, 91, 13, 1845);
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
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(91:9) {#if coords[1] > 1 && coords[0] > 1}",
    		ctx
    	});

    	return block;
    }

    // (97:9) {#if coords[1] < gridSize[1]  && coords[0] > 1}
    function create_if_block_1$1(ctx) {
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
    			attr_dev(button, "class", "downarrow svelte-1r102f");
    			add_location(button, file$3, 97, 13, 2052);
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
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(97:9) {#if coords[1] < gridSize[1]  && coords[0] > 1}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let span2;
    	let span1;
    	let span0;
    	let t;

    	function select_block_type(ctx, dirty) {
    		if (/*hasAValue*/ ctx[4]) return create_if_block_5;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);
    	let if_block1 = /*shouldShowArrows*/ ctx[6] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			span2 = element("span");
    			span1 = element("span");
    			span0 = element("span");
    			if_block0.c();
    			t = space();
    			if (if_block1) if_block1.c();
    			attr_dev(span0, "class", "centerpart svelte-1r102f");
    			add_location(span0, file$3, 63, 5, 1093);
    			attr_dev(span1, "class", "numbergrid svelte-1r102f");
    			attr_dev(span1, "id", /*textID*/ ctx[5]);
    			add_location(span1, file$3, 61, 4, 1047);
    			add_location(span2, file$3, 59, 0, 1035);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span2, anchor);
    			append_dev(span2, span1);
    			append_dev(span1, span0);
    			if_block0.m(span0, null);
    			append_dev(span1, t);
    			if (if_block1) if_block1.m(span1, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(span0, null);
    				}
    			}

    			if (/*shouldShowArrows*/ ctx[6]) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block$1(ctx);
    					if_block1.c();
    					if_block1.m(span1, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty & /*textID*/ 32) {
    				attr_dev(span1, "id", /*textID*/ ctx[5]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span2);
    			if_block0.d();
    			if (if_block1) if_block1.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let shouldShowArrows;
    	let textID;
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
    		textID,
    		shouldShowArrows
    	});

    	$$self.$inject_state = $$props => {
    		if ('numbers' in $$props) $$invalidate(0, numbers = $$props.numbers);
    		if ('coords' in $$props) $$invalidate(1, coords = $$props.coords);
    		if ('gridSize' in $$props) $$invalidate(2, gridSize = $$props.gridSize);
    		if ('buttonCallback' in $$props) $$invalidate(3, buttonCallback = $$props.buttonCallback);
    		if ('hasAValue' in $$props) $$invalidate(4, hasAValue = $$props.hasAValue);
    		if ('textID' in $$props) $$invalidate(5, textID = $$props.textID);
    		if ('shouldShowArrows' in $$props) $$invalidate(6, shouldShowArrows = $$props.shouldShowArrows);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*numbers*/ 1) {
    			$$invalidate(4, hasAValue = numbers.length > 0);
    		}

    		if ($$self.$$.dirty & /*hasAValue*/ 16) {
    			$$invalidate(6, shouldShowArrows = hasAValue);
    		}

    		if ($$self.$$.dirty & /*coords*/ 2) {
    			$$invalidate(5, textID = coords.join("-")); //needed for the tooltips
    		}
    	};

    	return [numbers, coords, gridSize, buttonCallback, hasAValue, textID, shouldShowArrows];
    }

    class GridSquare extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {
    			numbers: 0,
    			coords: 1,
    			gridSize: 2,
    			buttonCallback: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "GridSquare",
    			options,
    			id: create_fragment$3.name
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

    const file$2 = "src/Intro.svelte";

    function create_fragment$2(ctx) {
    	let h1;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let t4;
    	let t5;
    	let t6;
    	let t7;
    	let p0;
    	let t8;
    	let t9;
    	let t10;
    	let t11;
    	let t12;
    	let t13;
    	let t14;
    	let t15;
    	let p1;
    	let t16;
    	let t17;
    	let t18;
    	let t19;
    	let t20;
    	let t21_value = /*a*/ ctx[2] * /*b*/ ctx[1] + "";
    	let t21;
    	let t22;
    	let t23_value = /*a*/ ctx[2] * /*b*/ ctx[1] + "";
    	let t23;
    	let t24;
    	let t25;
    	let p2;
    	let t26;
    	let t27;
    	let t28;
    	let t29;
    	let t30;
    	let t31;
    	let t32;
    	let t33_value = /*a*/ ctx[2] * /*b*/ ctx[1] + "";
    	let t33;
    	let t34;
    	let t35;
    	let p3;
    	let t36;
    	let b_1;
    	let t38;
    	let t39;
    	let t40;
    	let t41;
    	let t42;
    	let t43;
    	let t44;
    	let t45_value = /*a*/ ctx[2] * /*b*/ ctx[1] + "";
    	let t45;
    	let t46;
    	let t47;
    	let p4;
    	let t48;
    	let u;
    	let t50;
    	let t51;
    	let p5;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			t0 = text("Spider-Math: Into the ");
    			t1 = text(/*a*/ ctx[2]);
    			t2 = text("*");
    			t3 = text(/*b*/ ctx[1]);
    			t4 = text("=");
    			t5 = text(/*AUProduct*/ ctx[0]);
    			t6 = text("iverse");
    			t7 = space();
    			p0 = element("p");
    			t8 = text("Welcome to the ");
    			t9 = text(/*a*/ ctx[2]);
    			t10 = text("*");
    			t11 = text(/*b*/ ctx[1]);
    			t12 = text("=");
    			t13 = text(/*AUProduct*/ ctx[0]);
    			t14 = text("niverse.");
    			t15 = space();
    			p1 = element("p");
    			t16 = text("In our universe, multiplication only works in one way. ");
    			t17 = text(/*a*/ ctx[2]);
    			t18 = text("*");
    			t19 = text(/*b*/ ctx[1]);
    			t20 = text(" is always ");
    			t21 = text(t21_value);
    			t22 = text(". But why ");
    			t23 = text(t23_value);
    			t24 = text(" in particular? It's easy to write down other equations like 2+2=5 - they're just not true in the universe we normally work with.");
    			t25 = space();
    			p2 = element("p");
    			t26 = text("...but what about other universes? What if there was an 🌌alternate universe🌌 which followed all the same math rules, but where ");
    			t27 = text(/*a*/ ctx[2]);
    			t28 = text("*");
    			t29 = text(/*b*/ ctx[1]);
    			t30 = text(" was, say, ");
    			t31 = text(/*AUProduct*/ ctx[0]);
    			t32 = text(" instead of ");
    			t33 = text(t33_value);
    			t34 = text("? Will everything implode into a puff of contradictions? Or will it somehow stay internally consistent? Let's find out.");
    			t35 = space();
    			p3 = element("p");
    			t36 = text("Below is an ");
    			b_1 = element("b");
    			b_1.textContent = "alternate-universe multiplication table";
    			t38 = text(", from an alternate universe where the rules of addition and multiplication work the same but ");
    			t39 = text(/*a*/ ctx[2]);
    			t40 = text("*");
    			t41 = text(/*b*/ ctx[1]);
    			t42 = text(" is ");
    			t43 = text(/*AUProduct*/ ctx[0]);
    			t44 = text(" instead of ");
    			t45 = text(t45_value);
    			t46 = text(".");
    			t47 = space();
    			p4 = element("p");
    			t48 = text("In our universe, if you move sideways along a row of a multiplication table, you add the same number repeatedly. That's true because of the ");
    			u = element("u");
    			u.textContent = "distributive property";
    			t50 = text(" in our universe - so if the rules of this alternate universe are the same, we can still use the distributive property to move sideways across rows and up/down across columns.");
    			t51 = space();
    			p5 = element("p");
    			p5.textContent = "Click the arrows to fill in the multiplication table, and you might find some interesting alternate-universe equations along the way.";
    			add_location(h1, file$2, 14, 0, 233);
    			attr_dev(p0, "class", "svelte-f7jo2g");
    			add_location(p0, file$2, 16, 0, 291);
    			attr_dev(p1, "class", "svelte-f7jo2g");
    			add_location(p1, file$2, 18, 0, 342);
    			attr_dev(p2, "class", "svelte-f7jo2g");
    			add_location(p2, file$2, 21, 0, 574);
    			add_location(b_1, file$2, 23, 15, 892);
    			attr_dev(p3, "class", "svelte-f7jo2g");
    			add_location(p3, file$2, 23, 0, 877);
    			add_location(u, file$2, 25, 143, 1222);
    			attr_dev(p4, "class", "svelte-f7jo2g");
    			add_location(p4, file$2, 25, 0, 1079);
    			attr_dev(p5, "class", "svelte-f7jo2g");
    			add_location(p5, file$2, 27, 0, 1431);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    			append_dev(h1, t2);
    			append_dev(h1, t3);
    			append_dev(h1, t4);
    			append_dev(h1, t5);
    			append_dev(h1, t6);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, p0, anchor);
    			append_dev(p0, t8);
    			append_dev(p0, t9);
    			append_dev(p0, t10);
    			append_dev(p0, t11);
    			append_dev(p0, t12);
    			append_dev(p0, t13);
    			append_dev(p0, t14);
    			insert_dev(target, t15, anchor);
    			insert_dev(target, p1, anchor);
    			append_dev(p1, t16);
    			append_dev(p1, t17);
    			append_dev(p1, t18);
    			append_dev(p1, t19);
    			append_dev(p1, t20);
    			append_dev(p1, t21);
    			append_dev(p1, t22);
    			append_dev(p1, t23);
    			append_dev(p1, t24);
    			insert_dev(target, t25, anchor);
    			insert_dev(target, p2, anchor);
    			append_dev(p2, t26);
    			append_dev(p2, t27);
    			append_dev(p2, t28);
    			append_dev(p2, t29);
    			append_dev(p2, t30);
    			append_dev(p2, t31);
    			append_dev(p2, t32);
    			append_dev(p2, t33);
    			append_dev(p2, t34);
    			insert_dev(target, t35, anchor);
    			insert_dev(target, p3, anchor);
    			append_dev(p3, t36);
    			append_dev(p3, b_1);
    			append_dev(p3, t38);
    			append_dev(p3, t39);
    			append_dev(p3, t40);
    			append_dev(p3, t41);
    			append_dev(p3, t42);
    			append_dev(p3, t43);
    			append_dev(p3, t44);
    			append_dev(p3, t45);
    			append_dev(p3, t46);
    			insert_dev(target, t47, anchor);
    			insert_dev(target, p4, anchor);
    			append_dev(p4, t48);
    			append_dev(p4, u);
    			append_dev(p4, t50);
    			insert_dev(target, t51, anchor);
    			insert_dev(target, p5, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*a*/ 4) set_data_dev(t1, /*a*/ ctx[2]);
    			if (dirty & /*b*/ 2) set_data_dev(t3, /*b*/ ctx[1]);
    			if (dirty & /*AUProduct*/ 1) set_data_dev(t5, /*AUProduct*/ ctx[0]);
    			if (dirty & /*a*/ 4) set_data_dev(t9, /*a*/ ctx[2]);
    			if (dirty & /*b*/ 2) set_data_dev(t11, /*b*/ ctx[1]);
    			if (dirty & /*AUProduct*/ 1) set_data_dev(t13, /*AUProduct*/ ctx[0]);
    			if (dirty & /*a*/ 4) set_data_dev(t17, /*a*/ ctx[2]);
    			if (dirty & /*b*/ 2) set_data_dev(t19, /*b*/ ctx[1]);
    			if (dirty & /*a, b*/ 6 && t21_value !== (t21_value = /*a*/ ctx[2] * /*b*/ ctx[1] + "")) set_data_dev(t21, t21_value);
    			if (dirty & /*a, b*/ 6 && t23_value !== (t23_value = /*a*/ ctx[2] * /*b*/ ctx[1] + "")) set_data_dev(t23, t23_value);
    			if (dirty & /*a*/ 4) set_data_dev(t27, /*a*/ ctx[2]);
    			if (dirty & /*b*/ 2) set_data_dev(t29, /*b*/ ctx[1]);
    			if (dirty & /*AUProduct*/ 1) set_data_dev(t31, /*AUProduct*/ ctx[0]);
    			if (dirty & /*a, b*/ 6 && t33_value !== (t33_value = /*a*/ ctx[2] * /*b*/ ctx[1] + "")) set_data_dev(t33, t33_value);
    			if (dirty & /*a*/ 4) set_data_dev(t39, /*a*/ ctx[2]);
    			if (dirty & /*b*/ 2) set_data_dev(t41, /*b*/ ctx[1]);
    			if (dirty & /*AUProduct*/ 1) set_data_dev(t43, /*AUProduct*/ ctx[0]);
    			if (dirty & /*a, b*/ 6 && t45_value !== (t45_value = /*a*/ ctx[2] * /*b*/ ctx[1] + "")) set_data_dev(t45, t45_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(p0);
    			if (detaching) detach_dev(t15);
    			if (detaching) detach_dev(p1);
    			if (detaching) detach_dev(t25);
    			if (detaching) detach_dev(p2);
    			if (detaching) detach_dev(t35);
    			if (detaching) detach_dev(p3);
    			if (detaching) detach_dev(t47);
    			if (detaching) detach_dev(p4);
    			if (detaching) detach_dev(t51);
    			if (detaching) detach_dev(p5);
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
    	let a;
    	let b;
    	let AUProduct;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Intro', slots, []);
    	let { startEquation = [2, 3, 8] } = $$props;
    	const writable_props = ['startEquation'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Intro> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('startEquation' in $$props) $$invalidate(3, startEquation = $$props.startEquation);
    	};

    	$$self.$capture_state = () => ({ startEquation, AUProduct, b, a });

    	$$self.$inject_state = $$props => {
    		if ('startEquation' in $$props) $$invalidate(3, startEquation = $$props.startEquation);
    		if ('AUProduct' in $$props) $$invalidate(0, AUProduct = $$props.AUProduct);
    		if ('b' in $$props) $$invalidate(1, b = $$props.b);
    		if ('a' in $$props) $$invalidate(2, a = $$props.a);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*startEquation*/ 8) {
    			$$invalidate(2, a = startEquation[0]);
    		}

    		if ($$self.$$.dirty & /*startEquation*/ 8) {
    			$$invalidate(1, b = startEquation[1]);
    		}

    		if ($$self.$$.dirty & /*startEquation*/ 8) {
    			$$invalidate(0, AUProduct = startEquation[2]);
    		}
    	};

    	return [AUProduct, b, a, startEquation];
    }

    class Intro extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { startEquation: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Intro",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get startEquation() {
    		throw new Error("<Intro>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set startEquation(value) {
    		throw new Error("<Intro>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __rest(s, e) {
        var t = {};
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
            t[p] = s[p];
        if (s != null && typeof Object.getOwnPropertySymbols === "function")
            for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
                if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                    t[p[i]] = s[p[i]];
            }
        return t;
    }
    function crossfade(_a) {
        var { fallback } = _a, defaults = __rest(_a, ["fallback"]);
        const to_receive = new Map();
        const to_send = new Map();
        function crossfade(from, node, params) {
            const { delay = 0, duration = d => Math.sqrt(d) * 30, easing = cubicOut } = assign(assign({}, defaults), params);
            const to = node.getBoundingClientRect();
            const dx = from.left - to.left;
            const dy = from.top - to.top;
            const dw = from.width / to.width;
            const dh = from.height / to.height;
            const d = Math.sqrt(dx * dx + dy * dy);
            const style = getComputedStyle(node);
            const transform = style.transform === 'none' ? '' : style.transform;
            const opacity = +style.opacity;
            return {
                delay,
                duration: is_function(duration) ? duration(d) : duration,
                easing,
                css: (t, u) => `
				opacity: ${t * opacity};
				transform-origin: top left;
				transform: ${transform} translate(${u * dx}px,${u * dy}px) scale(${t + (1 - t) * dw}, ${t + (1 - t) * dh});
			`
            };
        }
        function transition(items, counterparts, intro) {
            return (node, params) => {
                items.set(params.key, {
                    rect: node.getBoundingClientRect()
                });
                return () => {
                    if (counterparts.has(params.key)) {
                        const { rect } = counterparts.get(params.key);
                        counterparts.delete(params.key);
                        return crossfade(rect, node, params);
                    }
                    // if the node is disappearing altogether
                    // (i.e. wasn't claimed by the other list)
                    // then we need to supply an outro
                    items.delete(params.key);
                    return fallback && fallback(node, params, intro);
                };
            };
        }
        return [
            transition(to_send, to_receive, false),
            transition(to_receive, to_send, true)
        ];
    }

    /* src/ImplicationAnimationTooltip.svelte generated by Svelte v3.46.4 */

    const { console: console_1 } = globals;
    const file$1 = "src/ImplicationAnimationTooltip.svelte";

    // (115:0) {#if phase == 1}
    function create_if_block_3(ctx) {
    	let div6;
    	let div5;
    	let div0;
    	let t0_value = /*sourceCoords*/ ctx[0][0] + "";
    	let t0;
    	let t1;
    	let div1;
    	let t3;
    	let div2;
    	let t4_value = /*sourceCoords*/ ctx[0][1] + "";
    	let t4;
    	let t5;
    	let div3;
    	let t7;
    	let div4;
    	let t8;
    	let div6_intro;
    	let div6_outro;
    	let current;

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			div5 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div1 = element("div");
    			div1.textContent = "*";
    			t3 = space();
    			div2 = element("div");
    			t4 = text(t4_value);
    			t5 = space();
    			div3 = element("div");
    			div3.textContent = "=";
    			t7 = space();
    			div4 = element("div");
    			t8 = text(/*sourceNumber*/ ctx[1]);
    			add_location(div0, file$1, 117, 8, 3618);
    			add_location(div1, file$1, 118, 8, 3655);
    			add_location(div2, file$1, 119, 8, 3676);
    			add_location(div3, file$1, 120, 8, 3713);
    			add_location(div4, file$1, 121, 8, 3736);
    			attr_dev(div5, "class", "tooltipgrid svelte-1oavvu8");
    			add_location(div5, file$1, 116, 4, 3584);
    			attr_dev(div6, "class", "tooltip svelte-1oavvu8");
    			set_style(div6, "left", /*targetLeft*/ ctx[4] + "px");
    			set_style(div6, "top", /*targetTop*/ ctx[3] + "px");
    			add_location(div6, file$1, 115, 0, 3405);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, div5);
    			append_dev(div5, div0);
    			append_dev(div0, t0);
    			append_dev(div5, t1);
    			append_dev(div5, div1);
    			append_dev(div5, t3);
    			append_dev(div5, div2);
    			append_dev(div2, t4);
    			append_dev(div5, t5);
    			append_dev(div5, div3);
    			append_dev(div5, t7);
    			append_dev(div5, div4);
    			append_dev(div4, t8);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if ((!current || dirty & /*sourceCoords*/ 1) && t0_value !== (t0_value = /*sourceCoords*/ ctx[0][0] + "")) set_data_dev(t0, t0_value);
    			if ((!current || dirty & /*sourceCoords*/ 1) && t4_value !== (t4_value = /*sourceCoords*/ ctx[0][1] + "")) set_data_dev(t4, t4_value);
    			if (!current || dirty & /*sourceNumber*/ 2) set_data_dev(t8, /*sourceNumber*/ ctx[1]);

    			if (!current || dirty & /*targetLeft*/ 16) {
    				set_style(div6, "left", /*targetLeft*/ ctx[4] + "px");
    			}

    			if (!current || dirty & /*targetTop*/ 8) {
    				set_style(div6, "top", /*targetTop*/ ctx[3] + "px");
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (div6_outro) div6_outro.end(1);

    				div6_intro = create_in_transition(div6, /*receive*/ ctx[12], {
    					key: /*sourceID*/ ctx[9] + '-' + /*destinationID*/ ctx[10]
    				});

    				div6_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (div6_intro) div6_intro.invalidate();

    			div6_outro = create_out_transition(div6, /*send*/ ctx[11], {
    				key: /*sourceID*/ ctx[9] + '-' + /*destinationID*/ ctx[10]
    			});

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			if (detaching && div6_outro) div6_outro.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(115:0) {#if phase == 1}",
    		ctx
    	});

    	return block;
    }

    // (127:0) {#if phase == 2}
    function create_if_block_2(ctx) {
    	let div10;
    	let div9;
    	let div0;
    	let t0_value = /*sourceCoords*/ ctx[0][0] + "";
    	let t0;
    	let t1;
    	let div3;
    	let div1;
    	let t3;
    	let div2;
    	let t4;
    	let t5;
    	let t6;
    	let div4;
    	let t7_value = /*sourceCoords*/ ctx[0][1] + "";
    	let t7;
    	let t8;
    	let div5;
    	let t10;
    	let div8;
    	let div6;
    	let t11;
    	let t12;
    	let div7;
    	let t13;
    	let t14;
    	let div10_intro;
    	let div10_outro;
    	let current;

    	const block = {
    		c: function create() {
    			div10 = element("div");
    			div9 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div3 = element("div");
    			div1 = element("div");
    			div1.textContent = "*";
    			t3 = space();
    			div2 = element("div");
    			t4 = text(/*addSign*/ ctx[5]);
    			t5 = text(/*thingBeingAddedToBothSides*/ ctx[7]);
    			t6 = space();
    			div4 = element("div");
    			t7 = text(t7_value);
    			t8 = space();
    			div5 = element("div");
    			div5.textContent = "=";
    			t10 = space();
    			div8 = element("div");
    			div6 = element("div");
    			t11 = text(/*sourceNumber*/ ctx[1]);
    			t12 = space();
    			div7 = element("div");
    			t13 = text(/*addSign*/ ctx[5]);
    			t14 = text(/*thingBeingAddedToBothSides*/ ctx[7]);
    			add_location(div0, file$1, 129, 8, 4018);
    			add_location(div1, file$1, 131, 8, 4084);
    			add_location(div2, file$1, 132, 12, 4109);
    			attr_dev(div3, "class", "column svelte-1oavvu8");
    			add_location(div3, file$1, 130, 8, 4055);
    			add_location(div4, file$1, 134, 8, 4181);
    			add_location(div5, file$1, 135, 8, 4218);
    			add_location(div6, file$1, 137, 12, 4274);
    			add_location(div7, file$1, 138, 12, 4312);
    			attr_dev(div8, "class", "column svelte-1oavvu8");
    			add_location(div8, file$1, 136, 8, 4241);
    			attr_dev(div9, "class", "tooltipgrid svelte-1oavvu8");
    			add_location(div9, file$1, 128, 4, 3984);
    			attr_dev(div10, "class", "tooltip svelte-1oavvu8");
    			set_style(div10, "left", /*targetLeft*/ ctx[4] + "px");
    			set_style(div10, "top", /*targetTop*/ ctx[3] + "px");
    			add_location(div10, file$1, 127, 0, 3805);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div10, anchor);
    			append_dev(div10, div9);
    			append_dev(div9, div0);
    			append_dev(div0, t0);
    			append_dev(div9, t1);
    			append_dev(div9, div3);
    			append_dev(div3, div1);
    			append_dev(div3, t3);
    			append_dev(div3, div2);
    			append_dev(div2, t4);
    			append_dev(div2, t5);
    			append_dev(div9, t6);
    			append_dev(div9, div4);
    			append_dev(div4, t7);
    			append_dev(div9, t8);
    			append_dev(div9, div5);
    			append_dev(div9, t10);
    			append_dev(div9, div8);
    			append_dev(div8, div6);
    			append_dev(div6, t11);
    			append_dev(div8, t12);
    			append_dev(div8, div7);
    			append_dev(div7, t13);
    			append_dev(div7, t14);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if ((!current || dirty & /*sourceCoords*/ 1) && t0_value !== (t0_value = /*sourceCoords*/ ctx[0][0] + "")) set_data_dev(t0, t0_value);
    			if (!current || dirty & /*addSign*/ 32) set_data_dev(t4, /*addSign*/ ctx[5]);
    			if ((!current || dirty & /*sourceCoords*/ 1) && t7_value !== (t7_value = /*sourceCoords*/ ctx[0][1] + "")) set_data_dev(t7, t7_value);
    			if (!current || dirty & /*sourceNumber*/ 2) set_data_dev(t11, /*sourceNumber*/ ctx[1]);
    			if (!current || dirty & /*addSign*/ 32) set_data_dev(t13, /*addSign*/ ctx[5]);

    			if (!current || dirty & /*targetLeft*/ 16) {
    				set_style(div10, "left", /*targetLeft*/ ctx[4] + "px");
    			}

    			if (!current || dirty & /*targetTop*/ 8) {
    				set_style(div10, "top", /*targetTop*/ ctx[3] + "px");
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (div10_outro) div10_outro.end(1);

    				div10_intro = create_in_transition(div10, /*receive*/ ctx[12], {
    					key: /*sourceID*/ ctx[9] + '-' + /*destinationID*/ ctx[10]
    				});

    				div10_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (div10_intro) div10_intro.invalidate();

    			div10_outro = create_out_transition(div10, /*send*/ ctx[11], {
    				key: /*sourceID*/ ctx[9] + '-' + /*destinationID*/ ctx[10]
    			});

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div10);
    			if (detaching && div10_outro) div10_outro.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(127:0) {#if phase == 2}",
    		ctx
    	});

    	return block;
    }

    // (145:0) {#if phase == 3}
    function create_if_block_1(ctx) {
    	let div6;
    	let div5;
    	let div0;
    	let t1;
    	let div1;
    	let t3;
    	let div2;
    	let t5;
    	let div3;
    	let t7;
    	let div4;
    	let div6_intro;
    	let div6_outro;
    	let current;

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			div5 = element("div");
    			div0 = element("div");
    			div0.textContent = `${/*destinationCoords*/ ctx[6][0]}`;
    			t1 = space();
    			div1 = element("div");
    			div1.textContent = "*";
    			t3 = space();
    			div2 = element("div");
    			div2.textContent = `${/*destinationCoords*/ ctx[6][1]}`;
    			t5 = space();
    			div3 = element("div");
    			div3.textContent = "=";
    			t7 = space();
    			div4 = element("div");
    			div4.textContent = `${/*destinationNumber*/ ctx[8]}`;
    			add_location(div0, file$1, 147, 8, 4632);
    			add_location(div1, file$1, 148, 8, 4674);
    			add_location(div2, file$1, 149, 8, 4695);
    			add_location(div3, file$1, 150, 8, 4737);
    			add_location(div4, file$1, 151, 8, 4760);
    			attr_dev(div5, "class", "tooltipgrid svelte-1oavvu8");
    			add_location(div5, file$1, 146, 4, 4598);
    			attr_dev(div6, "class", "tooltip svelte-1oavvu8");
    			set_style(div6, "left", /*targetLeft*/ ctx[4] + "px");
    			set_style(div6, "top", /*targetTop*/ ctx[3] + "px");
    			add_location(div6, file$1, 145, 0, 4419);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, div5);
    			append_dev(div5, div0);
    			append_dev(div5, t1);
    			append_dev(div5, div1);
    			append_dev(div5, t3);
    			append_dev(div5, div2);
    			append_dev(div5, t5);
    			append_dev(div5, div3);
    			append_dev(div5, t7);
    			append_dev(div5, div4);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (!current || dirty & /*targetLeft*/ 16) {
    				set_style(div6, "left", /*targetLeft*/ ctx[4] + "px");
    			}

    			if (!current || dirty & /*targetTop*/ 8) {
    				set_style(div6, "top", /*targetTop*/ ctx[3] + "px");
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (div6_outro) div6_outro.end(1);

    				div6_intro = create_in_transition(div6, /*receive*/ ctx[12], {
    					key: /*sourceID*/ ctx[9] + '-' + /*destinationID*/ ctx[10]
    				});

    				div6_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (div6_intro) div6_intro.invalidate();

    			div6_outro = create_out_transition(div6, /*send*/ ctx[11], {
    				key: /*sourceID*/ ctx[9] + '-' + /*destinationID*/ ctx[10]
    			});

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			if (detaching && div6_outro) div6_outro.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(145:0) {#if phase == 3}",
    		ctx
    	});

    	return block;
    }

    // (157:0) {#if phase == 4}
    function create_if_block(ctx) {
    	let div6;
    	let div5;
    	let div0;
    	let t1;
    	let div1;
    	let t3;
    	let div2;
    	let t5;
    	let div3;
    	let t7;
    	let div4;
    	let div6_intro;
    	let div6_outro;
    	let current;

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			div5 = element("div");
    			div0 = element("div");
    			div0.textContent = `${/*destinationCoords*/ ctx[6][0]}`;
    			t1 = space();
    			div1 = element("div");
    			div1.textContent = "*";
    			t3 = space();
    			div2 = element("div");
    			div2.textContent = `${/*destinationCoords*/ ctx[6][1]}`;
    			t5 = space();
    			div3 = element("div");
    			div3.textContent = "=";
    			t7 = space();
    			div4 = element("div");
    			div4.textContent = `${/*destinationNumber*/ ctx[8]}`;
    			add_location(div0, file$1, 159, 8, 5047);
    			add_location(div1, file$1, 160, 8, 5089);
    			add_location(div2, file$1, 161, 8, 5110);
    			add_location(div3, file$1, 162, 8, 5152);
    			add_location(div4, file$1, 163, 8, 5173);
    			attr_dev(div5, "class", "tooltipgrid svelte-1oavvu8");
    			add_location(div5, file$1, 158, 4, 5013);
    			attr_dev(div6, "class", "tooltip svelte-1oavvu8");
    			set_style(div6, "left", /*targetLeft*/ ctx[4] + "px");
    			set_style(div6, "top", /*targetTop*/ ctx[3] + "px");
    			add_location(div6, file$1, 157, 0, 4834);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, div5);
    			append_dev(div5, div0);
    			append_dev(div5, t1);
    			append_dev(div5, div1);
    			append_dev(div5, t3);
    			append_dev(div5, div2);
    			append_dev(div5, t5);
    			append_dev(div5, div3);
    			append_dev(div5, t7);
    			append_dev(div5, div4);
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (!current || dirty & /*targetLeft*/ 16) {
    				set_style(div6, "left", /*targetLeft*/ ctx[4] + "px");
    			}

    			if (!current || dirty & /*targetTop*/ 8) {
    				set_style(div6, "top", /*targetTop*/ ctx[3] + "px");
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (div6_outro) div6_outro.end(1);

    				div6_intro = create_in_transition(div6, /*receive*/ ctx[12], {
    					key: /*sourceID*/ ctx[9] + '-' + /*destinationID*/ ctx[10]
    				});

    				div6_intro.start();
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (div6_intro) div6_intro.invalidate();

    			div6_outro = create_out_transition(div6, /*send*/ ctx[11], {
    				key: /*sourceID*/ ctx[9] + '-' + /*destinationID*/ ctx[10]
    			});

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			if (detaching && div6_outro) div6_outro.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(157:0) {#if phase == 4}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let t0;
    	let t1;
    	let t2;
    	let if_block3_anchor;
    	let current;
    	let if_block0 = /*phase*/ ctx[2] == 1 && create_if_block_3(ctx);
    	let if_block1 = /*phase*/ ctx[2] == 2 && create_if_block_2(ctx);
    	let if_block2 = /*phase*/ ctx[2] == 3 && create_if_block_1(ctx);
    	let if_block3 = /*phase*/ ctx[2] == 4 && create_if_block(ctx);

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
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
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
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*phase*/ ctx[2] == 1) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*phase*/ 4) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_3(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(t0.parentNode, t0);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*phase*/ ctx[2] == 2) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty & /*phase*/ 4) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block_2(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(t1.parentNode, t1);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			if (/*phase*/ ctx[2] == 3) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);

    					if (dirty & /*phase*/ 4) {
    						transition_in(if_block2, 1);
    					}
    				} else {
    					if_block2 = create_if_block_1(ctx);
    					if_block2.c();
    					transition_in(if_block2, 1);
    					if_block2.m(t2.parentNode, t2);
    				}
    			} else if (if_block2) {
    				group_outros();

    				transition_out(if_block2, 1, 1, () => {
    					if_block2 = null;
    				});

    				check_outros();
    			}

    			if (/*phase*/ ctx[2] == 4) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);

    					if (dirty & /*phase*/ 4) {
    						transition_in(if_block3, 1);
    					}
    				} else {
    					if_block3 = create_if_block(ctx);
    					if_block3.c();
    					transition_in(if_block3, 1);
    					if_block3.m(if_block3_anchor.parentNode, if_block3_anchor);
    				}
    			} else if (if_block3) {
    				group_outros();

    				transition_out(if_block3, 1, 1, () => {
    					if_block3 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);
    			transition_in(if_block2);
    			transition_in(if_block3);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			transition_out(if_block2);
    			transition_out(if_block3);
    			current = false;
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
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let addSign;
    	let targetRect;
    	let targetLeft;
    	let targetTop;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ImplicationAnimationTooltip', slots, []);
    	let { sourceCoords = [0, 0] } = $$props;
    	let { arrowDirection = [1, 0] } = $$props;
    	let { sourceNumber = 0 } = $$props;
    	let { addMultiplicationEntry = (x, y, newProduct) => null } = $$props;

    	let destinationCoords = sourceCoords.map((coord, i) => {
    		console.log(coord, i, arrowDirection[i]);
    		return coord + arrowDirection[i];
    	}); //x,y of final cell

    	console.log(destinationCoords);

    	//distributive law time!
    	//if coords are (3,2) and we move in the (1,0) direction, we're adding 2.
    	//if coords are (3,2) and we move in the (0,1) direction, we're adding 3. +y is down
    	let thingBeingAddedToBothSides = sourceCoords[1] * arrowDirection[0] + sourceCoords[0] * arrowDirection[1];

    	let destinationNumber = sourceNumber + thingBeingAddedToBothSides;

    	//html DOM IDs of GridSquare elements to appear over
    	let sourceID = sourceCoords.join("-");

    	let destinationID = destinationCoords.join("-");

    	const [send, receive] = crossfade({
    		duration: d => Math.sqrt(d * 1000),
    		fallback(node, params) {
    			const style = getComputedStyle(node);
    			const transform = style.transform === 'none' ? '' : style.transform;

    			return {
    				duration: 500,
    				css: t => `
			        transform: ${transform} scale(${t});
			        opacity: ${t}
		        `
    			};
    		}
    	});

    	let appearAboveThisID = sourceID;
    	let phase = 1;

    	//phase 1: over the source
    	window.setTimeout(toPhase2, 800);

    	//phase 2: +3 markers appear on both sides
    	function toPhase2() {
    		$$invalidate(2, phase = 2);
    		window.setTimeout(toPhase3, 1000);
    	}

    	//phase 3: add to both sides
    	function toPhase3() {
    		$$invalidate(2, phase = 3);
    		window.setTimeout(toPhase4, 1000);
    	}

    	//phase 4: move over target
    	function toPhase4() {
    		$$invalidate(15, appearAboveThisID = destinationID);
    		$$invalidate(2, phase = 4);
    		window.setTimeout(toPhase5, 500);
    		addMultiplicationEntry(destinationCoords[0], destinationCoords[1], destinationNumber);
    	}

    	//fade out.
    	//todo: remove from outer array
    	function toPhase5() {
    		$$invalidate(2, phase = 5);
    	}

    	const writable_props = ['sourceCoords', 'arrowDirection', 'sourceNumber', 'addMultiplicationEntry'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<ImplicationAnimationTooltip> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('sourceCoords' in $$props) $$invalidate(0, sourceCoords = $$props.sourceCoords);
    		if ('arrowDirection' in $$props) $$invalidate(13, arrowDirection = $$props.arrowDirection);
    		if ('sourceNumber' in $$props) $$invalidate(1, sourceNumber = $$props.sourceNumber);
    		if ('addMultiplicationEntry' in $$props) $$invalidate(14, addMultiplicationEntry = $$props.addMultiplicationEntry);
    	};

    	$$self.$capture_state = () => ({
    		sourceCoords,
    		arrowDirection,
    		sourceNumber,
    		addMultiplicationEntry,
    		destinationCoords,
    		thingBeingAddedToBothSides,
    		destinationNumber,
    		sourceID,
    		destinationID,
    		crossfade,
    		send,
    		receive,
    		appearAboveThisID,
    		phase,
    		toPhase2,
    		toPhase3,
    		toPhase4,
    		toPhase5,
    		targetRect,
    		targetTop,
    		targetLeft,
    		addSign
    	});

    	$$self.$inject_state = $$props => {
    		if ('sourceCoords' in $$props) $$invalidate(0, sourceCoords = $$props.sourceCoords);
    		if ('arrowDirection' in $$props) $$invalidate(13, arrowDirection = $$props.arrowDirection);
    		if ('sourceNumber' in $$props) $$invalidate(1, sourceNumber = $$props.sourceNumber);
    		if ('addMultiplicationEntry' in $$props) $$invalidate(14, addMultiplicationEntry = $$props.addMultiplicationEntry);
    		if ('destinationCoords' in $$props) $$invalidate(6, destinationCoords = $$props.destinationCoords);
    		if ('thingBeingAddedToBothSides' in $$props) $$invalidate(7, thingBeingAddedToBothSides = $$props.thingBeingAddedToBothSides);
    		if ('destinationNumber' in $$props) $$invalidate(8, destinationNumber = $$props.destinationNumber);
    		if ('sourceID' in $$props) $$invalidate(9, sourceID = $$props.sourceID);
    		if ('destinationID' in $$props) $$invalidate(10, destinationID = $$props.destinationID);
    		if ('appearAboveThisID' in $$props) $$invalidate(15, appearAboveThisID = $$props.appearAboveThisID);
    		if ('phase' in $$props) $$invalidate(2, phase = $$props.phase);
    		if ('targetRect' in $$props) $$invalidate(16, targetRect = $$props.targetRect);
    		if ('targetTop' in $$props) $$invalidate(3, targetTop = $$props.targetTop);
    		if ('targetLeft' in $$props) $$invalidate(4, targetLeft = $$props.targetLeft);
    		if ('addSign' in $$props) $$invalidate(5, addSign = $$props.addSign);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*appearAboveThisID*/ 32768) {
    			/*
    $: targetRect = document.getElementById(appearAboveThisID).getBoundingClientRect();
    $: targetLeft = targetRect.left + targetRect.width/2;
    $: targetTop = targetRect.top // + targetRect.height/2;*/
    			$$invalidate(16, targetRect = document.getElementById(appearAboveThisID));
    		}

    		if ($$self.$$.dirty & /*targetRect*/ 65536) {
    			$$invalidate(4, targetLeft = targetRect.offsetLeft + targetRect.offsetWidth / 2);
    		}

    		if ($$self.$$.dirty & /*targetRect*/ 65536) {
    			$$invalidate(3, targetTop = targetRect.offsetTop); // + targetRect.height/2;
    		}
    	};

    	$$invalidate(5, addSign = Math.sign(thingBeingAddedToBothSides) == 1 ? "+" : ""); //the negative sign will appear when we print thingBeingAddedToBothSides

    	return [
    		sourceCoords,
    		sourceNumber,
    		phase,
    		targetTop,
    		targetLeft,
    		addSign,
    		destinationCoords,
    		thingBeingAddedToBothSides,
    		destinationNumber,
    		sourceID,
    		destinationID,
    		send,
    		receive,
    		arrowDirection,
    		addMultiplicationEntry,
    		appearAboveThisID,
    		targetRect
    	];
    }

    class ImplicationAnimationTooltip extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			sourceCoords: 0,
    			arrowDirection: 13,
    			sourceNumber: 1,
    			addMultiplicationEntry: 14
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ImplicationAnimationTooltip",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get sourceCoords() {
    		throw new Error("<ImplicationAnimationTooltip>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set sourceCoords(value) {
    		throw new Error("<ImplicationAnimationTooltip>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get arrowDirection() {
    		throw new Error("<ImplicationAnimationTooltip>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set arrowDirection(value) {
    		throw new Error("<ImplicationAnimationTooltip>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get sourceNumber() {
    		throw new Error("<ImplicationAnimationTooltip>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set sourceNumber(value) {
    		throw new Error("<ImplicationAnimationTooltip>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get addMultiplicationEntry() {
    		throw new Error("<ImplicationAnimationTooltip>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set addMultiplicationEntry(value) {
    		throw new Error("<ImplicationAnimationTooltip>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.46.4 */
    const file = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[8] = list[i];
    	child_ctx[10] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[11] = list[i];
    	child_ctx[13] = i;
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[14] = list[i];
    	return child_ctx;
    }

    // (82:4) {#each implicationAnimations as tooltipData}
    function create_each_block_2(ctx) {
    	let implicationanimationtooltip;
    	let current;

    	implicationanimationtooltip = new ImplicationAnimationTooltip({
    			props: {
    				sourceCoords: /*tooltipData*/ ctx[14][0],
    				arrowDirection: /*tooltipData*/ ctx[14][1],
    				sourceNumber: /*tooltipData*/ ctx[14][2],
    				addMultiplicationEntry: /*addMultiplicationEntry*/ ctx[3]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(implicationanimationtooltip.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(implicationanimationtooltip, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const implicationanimationtooltip_changes = {};
    			if (dirty & /*implicationAnimations*/ 2) implicationanimationtooltip_changes.sourceCoords = /*tooltipData*/ ctx[14][0];
    			if (dirty & /*implicationAnimations*/ 2) implicationanimationtooltip_changes.arrowDirection = /*tooltipData*/ ctx[14][1];
    			if (dirty & /*implicationAnimations*/ 2) implicationanimationtooltip_changes.sourceNumber = /*tooltipData*/ ctx[14][2];
    			implicationanimationtooltip.$set(implicationanimationtooltip_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(implicationanimationtooltip.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(implicationanimationtooltip.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(implicationanimationtooltip, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(82:4) {#each implicationAnimations as tooltipData}",
    		ctx
    	});

    	return block;
    }

    // (87:7) {#each column as values, i}
    function create_each_block_1(ctx) {
    	let gridsquare;
    	let current;

    	gridsquare = new GridSquare({
    			props: {
    				numbers: /*values*/ ctx[11],
    				coords: [/*i*/ ctx[13] + 1, /*j*/ ctx[10] + 1],
    				buttonCallback: /*buttonClick*/ ctx[4],
    				gridSize: /*gridSize*/ ctx[2]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(gridsquare.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(gridsquare, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const gridsquare_changes = {};
    			if (dirty & /*numbers*/ 1) gridsquare_changes.numbers = /*values*/ ctx[11];
    			gridsquare.$set(gridsquare_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(gridsquare.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(gridsquare.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(gridsquare, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(87:7) {#each column as values, i}",
    		ctx
    	});

    	return block;
    }

    // (86:5) {#each numbers as column, j}
    function create_each_block(ctx) {
    	let each_1_anchor;
    	let current;
    	let each_value_1 = /*column*/ ctx[8];
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

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
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*numbers, buttonClick, gridSize*/ 21) {
    				each_value_1 = /*column*/ ctx[8];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				group_outros();

    				for (i = each_value_1.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
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
    		source: "(86:5) {#each numbers as column, j}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let intro;
    	let t0;
    	let div1;
    	let t1;
    	let div0;
    	let current;

    	intro = new Intro({
    			props: { startEquation: [2, 3, 2] },
    			$$inline: true
    		});

    	let each_value_2 = /*implicationAnimations*/ ctx[1];
    	validate_each_argument(each_value_2);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks_1[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	const out = i => transition_out(each_blocks_1[i], 1, 1, () => {
    		each_blocks_1[i] = null;
    	});

    	let each_value = /*numbers*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out_1 = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			create_component(intro.$$.fragment);
    			t0 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t1 = space();
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(div0, "class", "biggrid svelte-yqp3f");
    			add_location(div0, file, 84, 4, 2348);
    			attr_dev(div1, "class", "position: relative");
    			add_location(div1, file, 80, 0, 2071);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(intro, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div1, anchor);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div1, null);
    			}

    			append_dev(div1, t1);
    			append_dev(div1, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*implicationAnimations, addMultiplicationEntry*/ 10) {
    				each_value_2 = /*implicationAnimations*/ ctx[1];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    						transition_in(each_blocks_1[i], 1);
    					} else {
    						each_blocks_1[i] = create_each_block_2(child_ctx);
    						each_blocks_1[i].c();
    						transition_in(each_blocks_1[i], 1);
    						each_blocks_1[i].m(div1, t1);
    					}
    				}

    				group_outros();

    				for (i = each_value_2.length; i < each_blocks_1.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (dirty & /*numbers, buttonClick, gridSize*/ 21) {
    				each_value = /*numbers*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div0, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out_1(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro$1(local) {
    			if (current) return;
    			transition_in(intro.$$.fragment, local);

    			for (let i = 0; i < each_value_2.length; i += 1) {
    				transition_in(each_blocks_1[i]);
    			}

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(intro.$$.fragment, local);
    			each_blocks_1 = each_blocks_1.filter(Boolean);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				transition_out(each_blocks_1[i]);
    			}

    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(intro, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks_1, detaching);
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
    	let startEquation = [3, 2, 2]; //2*3 = 2
    	let numbers = [];

    	for (let i = 0; i < gridSize[0]; i++) {
    		//might be gridSize[1] here
    		let column = [];

    		for (let i = 0; i < gridSize[1]; i++) {
    			column.push([]);
    		}

    		numbers.push(column);
    	}

    	//first row
    	for (let i = 0; i < gridSize[0]; i++) {
    		numbers[i][0] = [i + 1];
    	}

    	//first column
    	for (let i = 0; i < gridSize[1]; i++) {
    		numbers[0][i] = [i + 1];
    	}

    	function addMultiplicationEntry(x, y, newProduct) {
    		if (!numbers[y - 1][x - 1].includes(newProduct)) {
    			numbers[y - 1][x - 1].push(newProduct);
    		}

    		notifySvelteOfChange();
    	}

    	function getMultiplicationEntry(x, y, product) {
    		return numbers[y - 1][x - 1];
    	}

    	function notifySvelteOfChange(x, y) {
    		$$invalidate(0, numbers);
    	}

    	addMultiplicationEntry(...startEquation); //2*3 = 2
    	let implicationAnimations = []; //these guys appear when you click a button, show an animation, then calls addMultiplicationEntry 

    	function buttonClick(sourceCoords, arrowDirection) {
    		//todo: check if sourceCoords[0] and sourceCoords[1] are in bounds
    		let sourceX = sourceCoords[0];

    		let sourceY = sourceCoords[1];
    		let sourceNumbers = numbers[sourceY - 1][sourceX - 1];
    		let targetX = sourceCoords[0] + arrowDirection[0];
    		let targetY = sourceCoords[1] + arrowDirection[1];
    		numbers[targetY - 1][targetX - 1];

    		for (let number of sourceNumbers) {
    			//if(!numbers[targetY-1][targetX-1].includes(newNumber)){
    			//}
    			implicationAnimations.push([sourceCoords, arrowDirection, number]);

    			$$invalidate(1, implicationAnimations);
    		}
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		GridSquare,
    		Intro,
    		ImplicationAnimationTooltip,
    		gridSize,
    		startEquation,
    		numbers,
    		addMultiplicationEntry,
    		getMultiplicationEntry,
    		notifySvelteOfChange,
    		implicationAnimations,
    		buttonClick
    	});

    	$$self.$inject_state = $$props => {
    		if ('gridSize' in $$props) $$invalidate(2, gridSize = $$props.gridSize);
    		if ('startEquation' in $$props) startEquation = $$props.startEquation;
    		if ('numbers' in $$props) $$invalidate(0, numbers = $$props.numbers);
    		if ('implicationAnimations' in $$props) $$invalidate(1, implicationAnimations = $$props.implicationAnimations);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [numbers, implicationAnimations, gridSize, addMultiplicationEntry, buttonClick];
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
