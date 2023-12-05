var html = (() => {

    let javascriptRef = /javascript:([^(]*).*/

    let commands = {
        // ===============================
        // Literals
        // ===============================
        "s": function (elt, env) {  // push string onto stack
            env.stack.push(elt.innerText);
        },
        "data": function (elt, env) {  // push number onto stack
            env.stack.push(Number.parseFloat(elt.getAttribute('value')));
        },
        "ol": function (elt, env) {  // create list
            let children = elt.children;
            let initialLength = env.stack.length;
            let result = [];
            for (const child of children) {
                exec(child.firstElementChild, child, env);
                result.push(env.stack.pop());
                env.stack.length = initialLength;
            }
            env.stack.push(result);
        },
        "table" : function (elt, env) { // create an object
            let headers = Array.from(elt.querySelectorAll("th"));
            let data = Array.from((elt.querySelectorAll("td")));
            let result = {};
            let initialLength = env.stack.length;
            for (let i = 0; i < headers.length; i++) {
                const header = headers[i];
                const datum = data[i];
                if (datum) {
                    exec(datum.firstElementChild, datum, env);
                    result[header.innerText] = env.stack.pop();
                }
                env.stack.length = initialLength;
            }
            env.stack.push(result);
        },
        // ===============================
        // Math Commands
        // ===============================
        "dd": function (elt, env) {  // add two numbers on top of stack
            let top = env.stack.pop();
            let next = env.stack.pop();
            env.stack.push(next + top);
        },
        "sub": function (elt, env) {  // sub two numbers on top of stack
            let top = env.stack.pop();
            let next = env.stack.pop();
            env.stack.push(next - top);
        },
        "ul": function (elt, env) {  // multiply two numbers on top of stack
            let top = env.stack.pop();
            let next = env.stack.pop();
            env.stack.push(next * top);
        },
        "div": function (elt, env) {  // divide two numbers on top of stack
            let top = env.stack.pop();
            let next = env.stack.pop();
            env.stack.push(next / top);
        },
        // ===============================
        // Stack Manipulation Commands
        // ===============================
        "dt": function (elt, env) {  // duplicate top of stack
            env.stack.push(env.stack.at(-1));
        },
        "del": function (elt, env) {  // deletes the top of stack
            env.stack.pop();
        },
        // ===============================
        // Comparison Commands
        // ===============================
        "big": function (elt, env) { // next > top
            let top = env.stack.pop();
            let next = env.stack.pop();
            env.stack.push(next > top);
        },
        "small": function (elt, env) { // next < top
            let top = env.stack.pop();
            let next = env.stack.pop();
            env.stack.push(next < top);
        },
        "em": function (elt, env) { // equal, mostly
            let top = env.stack.pop();
            let next = env.stack.pop();
            env.stack.push(next == top);
        },
        // ===============================
        // Logical Operators
        // ===============================
        "b": function (elt, env) { // logical and
            let top = env.stack.pop();
            let next = env.stack.pop();
            env.stack.push(top && next);
        },
        "bdi": function (elt, env) { // logical not (invert)
            let top = env.stack.pop();
            env.stack.push(!top);
        },
        "bdo": function (elt, env) { // logical or
            let top = env.stack.pop();
            let next = env.stack.pop();
            env.stack.push(next || top);
        },
        // ===============================
        // Control Flow
        // ===============================
        "i": function (elt, env) {      // conditionally execute child instructions if true is on the top of the stack
            let topOfStack = env.stack.pop();
            if (topOfStack) {
                return elt.firstElementChild;
            }
        },
        "rt": function() { // return by returning null
            return null;
        },
        "a": function (elt, env) {          // either jump or invoke a function
            let href = elt.getAttribute("href");
            let regexMatch = javascriptRef.exec(href);
            if (regexMatch) {

                let functionName = regexMatch.at(1);

                // collect args
                let args = [];
                if (elt.firstElementChild) {
                    let initialLength = env.stack.length;
                    exec(elt.firstElementChild, elt, env);
                    let finalLength = env.stack.length;
                    args = env.stack.slice(initialLength, finalLength);
                    env.stack.length = initialLength;
                }

                let result = null;
                if (elt.getAttribute("target") === "_top") {
                    let target = env.stack.pop();
                    result = target[functionName](...args);
                } else {
                    let functionToCall = window[functionName];
                    result = functionToCall(...args);
                }

                if (typeof result != "undefined") {
                    env.stack.push(result);
                }
            } else {
                return document.getElementById(href.substring(1));
            }
        },
        // ===============================
        // Variables
        // ===============================
        "var": function (elt, env) {
            let topOfStack = env.stack.pop();
            let variableName = elt.title;
            env.vars[variableName] = topOfStack;
        },
        "cite": function (elt, env) { // loads a variable
            let variableName = elt.innerText;
            if (typeof(env.vars[variableName]) !== "undefined") {
                env.stack.push(env.vars[variableName]);
            } else {
                env.stack.push(window[variableName]);
            }
        },
        // ===============================
        // I/O
        // ===============================
        "input": function (elt, env) {  // get input from user
            let value = prompt(elt.getAttribute('placeholder'));
            if (elt.getAttribute('type') === "number") {
                value = Number.parseFloat(value);
            }
            env.stack.push(value);
        },
        "output": function (elt, env) { // outputs to standard out
            let top = env.stack.at(-1);
            meta.out(top);
        },
        // ===============================
        // Properties
        // ===============================
        "rp" : function (elt, env) { // read a property from the top element on the stack
            let top = env.stack.pop();
            let propVal = top[elt.innerText];
            env.stack.push(propVal);
        },
        "samp" : function (elt, env) { // set a property on the second element from the top of the stack to the value on  the top of the stack
            let val = env.stack.pop();
            let target = env.stack.pop();
            target[elt.innerText] = val;
        },
        // ===============================
        // Arrays/Dynamic Properties
        // ===============================
        "address" : function (elt, env) { // read an offset into an array on the top element on the stack
            let index = env.stack.pop();
            let array = env.stack.pop();
            env.stack.push(array[index]);
        },
        "ins" : function (elt, env) { // insert the top of the stack into the array third from the top at index second
            let val = env.stack.pop();
            let index = env.stack.pop();
            let array = env.stack.pop();
            array[index] = val;
        },
        // ===============================
        // Functions
        // ===============================
        "dfn": function (elt, env) {},
        // ===============================
        // Programs
        // ===============================
        "main": function (elt, env) {
            return elt.firstElementChild;
        },
        "body": function (elt, env) {
            return elt.firstElementChild;
        },
    };

    let meta = {
        out: console.log,
        error: console.error,
        commands
    }

    function nextEltToExec(elt) {
        if (elt == null || elt.matches("body, main")) {
            return null;
        } else if (elt.nextElementSibling) {
            return elt.nextElementSibling;
        } else {
            return nextEltToExec(elt.parentElement);
        }
    }

    function defineFunctions(sourceOrElt) {
        let definitions = sourceOrElt.querySelectorAll('dfn');
        for (const definition of definitions) {
            if (definition.parentElement.tagName !== "MAIN") {
                meta.error("Function defined at ", definition, " does not have a parent MAIN element, instead found ", definition.parentElement);
                continue;
            }
            let func = function () {
                var args = Array.from(arguments);
                let env = makeEnv({});
                env.stack.push(...args);
                if (definition.firstElementChild) {
                    exec(definition.firstElementChild, definition, env);
                }
                let val = env.stack.pop();
                return val;
            }
            window[definition.id] = func;
        }
    }

    function makeEnv(vars) {
        return {
            stack: [],
            vars: { // start with standard variables for common values
                true:true,
                false:false,
                null:null
            },
        }
    }

    function makeHDB() {
        var hdb = {
            break() {},
            step() {
                hdb.result = "step";
            },
            continue() {
                hdb.result = "continue";
            },
            jumpTo(elt) {
                hdb.result = elt;
            }
        }
        return hdb;
    }

    function exec(sourceOrElt, root, env) {
        if (sourceOrElt == null) {
            meta.error("No html source detected")
            return;
        }
        if (typeof(sourceOrElt) === 'string') {
            let domParser = new DOMParser();
            let newDoc = domParser.parseFromString(sourceOrElt, "text/html");
            exec(newDoc.body);
        } else {
            // set the root element if necessary
            root ||= sourceOrElt;
            // create an environment if necessary
            env ||= makeEnv();
            // set the current element to execute
            let eltToExec = sourceOrElt;
            // define all functions within the element
            defineFunctions(eltToExec);
            do {
                // resolve command for the current element
                let commandForElt = meta.commands[eltToExec.tagName.toLowerCase()];
                if (commandForElt) {
                    // debugger implementation
                    if (meta.hdb == null && eltToExec.hasAttribute("data-hdb-breakpoint")) {
                        meta.hdb = makeHDB();
                    }
                    if (meta.hdb && meta.debug) {
                        meta.hdb.result = "step";
                        meta.debug(meta.hdb, eltToExec, env, commandForElt);
                        if (meta.hdb.result === "continue") {
                            meta.hdb = null;
                        } else if (typeof (meta.hdb.result) == "object") {
                            commandForElt = meta.hdb.result;
                            continue;
                        }
                        // else step
                    }
                    // invoke command and get next element
                    var next = commandForElt(eltToExec, env);
                    if (next === undefined) {
                        eltToExec = nextEltToExec(eltToExec);
                    } else {
                        eltToExec = next;
                    }
                    // if the next element is outside the root, we are done
                    if (!root.contains(eltToExec)){
                        return;
                    }
                } else {
                    // bad command
                    meta.out("Could not find command definition for ", eltToExec);
                    break;
                }
            } while (eltToExec)
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        let mainElts = document.querySelectorAll('main');
        for (const main of mainElts) {
            main.dispatchEvent(new Event("html:beforeExec", {bubbles:true}));
            exec(main);
            main.dispatchEvent(new Event("html:afterExec", {bubbles:true}));
        }
    });

    return {exec, meta};
})();
