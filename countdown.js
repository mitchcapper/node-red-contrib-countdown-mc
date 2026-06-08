/*
 Countdown-mc V2.0.0 29-Aug-2025 by Linker3000, Mitch Capper & contributors

 Based on node-red-contrib-countdown-2 V1.4.2 by Marc.

 Broad compatibility with the functions of countdown-2.

 No warranties, use at your own risk etc..

 No formal support.

 MIT Licence

Changes:

  V2.1.0:

  * Added multi-stream (per-topic) support: independent timers/multipliers/warnings per stream
  * Added leading comparison operators (>N floor, <N ceiling) for the control input
  * Added multiplier support (*N) to scale the active timer
  * Added warning output (third output) with a configurable threshold; emits raw numeric time
  * Note: operators (>N/<N) and multipliers (*N) follow the same gating as numeric values -
    they require the "control" topic unless "All messages...as control" is enabled.
  * Fixed: in "all messages as control" mode, a 0 / "0" value now stops the timer (was a no-op);
    signed-string zeros ("+0"/"-0") remain relative no-ops.
  * Added: named commands (pause/reset/cancel/preload) are honored in "all messages as control" mode.
  * Added optional "reason property": when set, start/stop messages are stamped with why they fired
    (start: newMessage/control/reset/preload/restart; stop: expired/stopped/cancelled). Blank = off.

  V2.0.0:

  * Added milliseconds support for more precise timing
  * Added hours support for longer time spans
  * Added high precision option with 100ms updates for any time unit
  * Fixed issue with startCountdownOnControlMessage not using the payload time
  * Improved UI with dropdown for time unit selection (milliseconds, seconds, minutes, hours)
  * Replaced separate checkboxes with a single dropdown for cleaner interface
  * Reordered dropdown options from smallest to largest time unit
  * Enhanced description for setTimeToNewWhileRunning option for better clarity
  * Standardized time display format to show hours, minutes and seconds as appropriate
  * Added one decimal place precision for time display when in high precision mode
  * Added configurable property input using standard Node-RED property selector
  * Added option to treat any message with a numeric value in the configured property
    as a control message (without requiring "control" topic)
  * Fixed issue with countdown sometimes showing negative values


  V1.6.0:

  * Fixed spurious 'true' output sent under some circumstances.
  * Clarified comments about STOP and START commands.

 Original fixes and changes/enhancements from countdown-2:

  - STOP command fully evaluated - payload can be '0', 'off', 'stop', false or 0.
      -- Not case sensitive.
  - START command fully evaluated - payload can be '1', 'on', 'start', true or 1.
      -- Not case sensitive.
  - Node output and node status messages are in seconds or minutes
    to match node config.
  - Countdown goes to zero.
  - Minor syntax changes and code tidies.
  - "control" input is now case insensitive and can be a number or
      string with or without a sign:
    - If the input is a plain number, the current countdown is set to
      that number (in minutes or seconds according to node setting).
    - If the number is a negative integer (eg -10), a string with a plus or
      minus sign (eg: "+12" or "-12") OR the number is a string or decimal fraction
      (eg: 10.1 or "10.1" or -10.1 etc) the countdown is increased or decreased by that
      (truncated) amount (fraction part is discarded). Note that a positive integer
      input with a sign (eg: +10) is treated by javascript as plain old 10, so you can't
      use that method to add amounts to the count; use a fraction or make it a
      string (eg: 30.1 or "+30").
    - "PAUSE" will pause the countdown. The node will still output its current (paused)
      value every second. The countdown will resume with the next pause input (in effect,
      'pause' toggles the counter), or if the countdown value is changed as above.
      The 'PRELOAD' command will restart a count at the current set value (provided it's
      not zero and the count is not currently running). This allows a count to be stopped,
      a new value set and the count started from this value rather than the one set in
      the node's interface.

    If any action makes the countdown zero or negative, it will be stopped at zero.

*/

module.exports = function(RED) {
    "use strict";

    function countdown(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.config = config;

        // Handle migration from checkbox-based settings to dropdown
        if (config.timeUnit === undefined) {
            if (config.minuteCounter) {
                node.config.timeUnit = "minutes";
            } else {
                node.config.timeUnit = "seconds";
            }
        }
        if (! config.property ) {
            node.config.property = "payload";
            node.config.propertyType = "msg";
        }
        if (config.allMessagesWithInputDelayAreControl === undefined) {
            node.config.allMessagesWithInputDelayAreControl = false;
        }
        if (config.reasonProperty === undefined) {
            node.config.reasonProperty = "";
        }

        // Local variables
        var ticker = null;
        var timeUnit = node.config.timeUnit;
        var timeout = timeRebase(parseInt(node.config.timer));
        var streams = {};
        var lastTriggeredStreamId = null;

        function getStream(id) {
            if (!streams[id]) {
                streams[id] = {
                    secs: -1,
                    timerPaused: false,
                    multiplier: 1,
                    warned: false,
                    stopMsg: {}
                };
            }
            return streams[id];
        }

        function applyMultiplier(rebasedSecs, stream) { return rebasedSecs * stream.multiplier; }

        // Stamps why a start/stop fired onto the outgoing message, but only when the user has
        // named a target property. Left blank (default) nothing is added, preserving the original
        // message shape. Supports nested paths (e.g. "data.reason") via setMessageProperty.
        function setReason(msg, reason) {
            if (msg && node.config.reasonProperty) {
                RED.util.setMessageProperty(msg, node.config.reasonProperty, reason, true);
            }
        }
        function warningThresholdSecs() {
            var w = parseFloat(node.config.warningTime);
            return (isNaN(w) || w <= 0) ? null : timeRebase(w);
        }

        function checkWarning(stream, streamId) {
            var t = warningThresholdSecs();
            if (t === null) return;
            if (stream.secs > t) { stream.warned = false; return; }
            if (stream.secs > 0 && !stream.warned) {
                stream.warned = true;
                var rawRemaining = Number((stream.secs / timeRebase(1)).toFixed(2));
                var wmsg = { payload: rawRemaining };
                if (node.config.handle === 'each' && node.config.streamProperty) {
                    RED.util.setMessageProperty(wmsg, node.config.streamProperty, streamId);
                } else if (node.config.topic !== '') wmsg.topic = node.config.topic;
                node.send([null, null, wmsg]);
            }
        }

        function updateStatus() {
            // Prefer the most recently triggered stream as the one shown, if it qualifies.
            function pick(list) {
                if (lastTriggeredStreamId !== null && list.indexOf(lastTriggeredStreamId) !== -1) {
                    return streams[lastTriggeredStreamId];
                }
                return streams[list[0]];
            }

            // Nothing actually counts down unless the ticker is running. A stream can hold a
            // value (secs > 0) while stopped - e.g. a delay set with auto-start off, awaiting a
            // 'preload'/start. Show that as Stopped (with the loaded value), never as Running.
            if (!ticker) {
                var loaded = [];
                for (var id in streams) { if (streams[id].secs > 0) loaded.push(id); }
                if (loaded.length === 0) {
                    node.status({ fill:"red", shape:"dot", text:"Stopped" });
                } else {
                    node.status({ fill:"red", shape:"dot", text:"Stopped: " + timerremain(pick(loaded).secs) });
                }
                return;
            }

            var running = [];   // counting down (not paused)
            var paused = [];    // has time left but paused
            for (var id in streams) {
                if (streams[id].secs > 0) {
                    if (streams[id].timerPaused) { paused.push(id); }
                    else { running.push(id); }
                }
            }

            if (running.length === 0 && paused.length === 0) {
                node.status({ fill:"red", shape:"dot", text:"Stopped" });
            } else if (running.length === 0) {
                var ps = pick(paused);
                node.status({ fill:"yellow", shape:"ring", text:"Paused: " + timerremain(ps.secs) });
            } else if (running.length === 1) {
                var rs = pick(running);
                node.status({ fill:"green", shape:"dot", text:"Running: " + timerremain(rs.secs) });
            } else {
                // Only count actively-running streams in the total (excludes paused/stopped).
                var rs2 = pick(running);
                node.status({ fill:"green", shape:"dot", text:"Running: " + timerremain(rs2.secs) + " (" + running.length + " total streams)" });
            }
        }
        var tickInterval = node.config.highPrecision ? 100 : 1000; // Default tick in milliseconds

        this.status({
            fill: "red",
            shape: "dot",
            text: "INIT Stopped: " + timerremain(timeRebase(parseInt(node.config.timer)))
        });

        function timeRebase(timeinsecs) {
            switch(timeUnit) {
                case "milliseconds":
                    // If in milliseconds mode, convert to seconds for internal handling
                    return (timeinsecs / 1000);
                case "minutes":
                    // If in minutes mode, convert to seconds for internal handling
                    return (timeinsecs * 60);
                case "hours":
                    // If in hours mode, convert to seconds for internal handling
                    return (timeinsecs * 3600);
                default:
                    // Default is seconds
                    return timeinsecs;
            }
        }

        function timerremain(secs) {
            var displayValue;

            // Prepare the seconds display format - decimal only for high precision when under 60 seconds
            var secondsDisplay;
            if (node.config.highPrecision && secs < 60) {
                secondsDisplay = secs.toFixed(1) + "s";
            } else {
                secondsDisplay = Math.floor(secs % 60) + "s";
            }

            // Format time according to the standardized format
            if (secs >= 3600) {
                // More than 60 minutes: show hours, minutes and seconds
                var hours = Math.floor(secs / 3600);
                var minutes = Math.floor((secs % 3600) / 60);
                displayValue = hours + "h " + minutes + "m " + secondsDisplay;
            } else if (secs >= 60) {
                // More than 60 seconds: show minutes and seconds
                var minutes = Math.floor(secs / 60);
                displayValue = minutes + "m " + secondsDisplay;
            } else {
                // Less than 60 seconds: show seconds only
                displayValue = secondsDisplay;
            }

            return displayValue;
        }

        function startTimer(preload, stream, streamId, reason = "newMessage") {
            if (!preload) {
                timeout = timeRebase(parseInt(node.config.timer));
                stream.secs = timeout;
            }
            stream.timerPaused = false;
            stream.warned = false;
            checkWarning(stream, streamId);

            // Start ticking before updating status so the stream is genuinely counting down
            // (updateStatus only reports "Running" when the ticker is active).
            if (!ticker) {
                // Use tickInterval variable that we've already defined earlier in the code
                ticker = setInterval(function() {
                    node.emit("TIX");
                }, tickInterval);
            }

            updateStatus();
			// only send start msg if type is not equal "send nothing" option
            if (node.config.payloadTimerStartType !== "nul") {
                // Timer Message
                var msg = {}
                msg.payload = RED.util.evaluateNodeProperty(node.config.payloadTimerStart, node.config.payloadTimerStartType, node);
                setReason(msg, reason);
                if (node.config.handle === 'each' && node.config.streamProperty) {
                    RED.util.setMessageProperty(msg, node.config.streamProperty, streamId);
                } else if (node.config.topic !== '') {
                    msg.topic = node.config.topic;
                }
                node.send([msg, null]);
            }
        }

        function stopTimer(stream, streamId, output = true, reason = "stopped") {
            // Timer Message
            // only send stop msg if type is not equal "send nothing" option
            if (node.config.payloadTimerStopType !== "nul") {
                var msg = {}
                var cancel = false;
                if (output) {
                    if (node.config.payloadTimerStopType === 'msg') {
                        // shallow-copy so we don't stamp 'reason' onto the stored stopMsg
                        msg = Object.assign({}, stream.stopMsg);
                    } else {
                        msg.payload = RED.util.evaluateNodeProperty(node.config.payloadTimerStop, node.config.payloadTimerStopType, node);
                    }
                    // Tell downstream WHY the stop fired: the payload (e.g. false) is identical
                    // for a natural expiry and an explicit stop command. Only added when the
                    // user configured a reason property.
                    setReason(msg, reason);
                    if (node.config.handle === 'each' && node.config.streamProperty) {
                        RED.util.setMessageProperty(msg, node.config.streamProperty, streamId);
                    } else if (node.config.topic !== '') {
                        msg.topic = node.config.topic;
                    }
                } else {
                    msg = null;
                    cancel = true;
                }
				var remainingsecsMsg = {
                    "payload": timerremain(0),
                    "cancled": cancel
                };
                setReason(remainingsecsMsg, reason);

                if (node.config.handle === 'each' && node.config.streamProperty) {
                    RED.util.setMessageProperty(remainingsecsMsg, node.config.streamProperty, streamId);
                } else if (node.config.topic !== '') {
                    remainingsecsMsg.topic = node.config.topic;
                }
                node.send([msg, remainingsecsMsg]);
            }

            stream.secs = -1;
            stream.warned = false;

            // Prune fully-idle streams to avoid unbounded growth in 'each' mode.
            // Keep any stream holding a non-default multiplier so it persists (only *N changes it),
            // and keep paused streams so they can be resumed.
            if (stream.multiplier === 1 && !stream.timerPaused) {
                delete streams[streamId];
            }

            var anyRunning = false;
            for (var id in streams) { if (streams[id].secs > 0) anyRunning = true; }
            if (!anyRunning) {
                endTicker();
                updateStatus();
            } else {
                updateStatus();
            }
        }

        function endTicker() {
            if (ticker) {
                clearInterval(ticker);
                ticker = null;
            }
        }

        node.on("TIX", function() {
            var activeCount = 0;
            for (var id in streams) {
                var stream = streams[id];
                if (stream.secs > 0.1) {
                    if (!stream.timerPaused) {
                        if (node.config.highPrecision) {
                            stream.secs -= 0.1; // Decrement by 0.1 for high precision mode
                        } else {
                            stream.secs -= 1; // Standard 1 second decrement
                        }
                    }
                    if (stream.secs < 0) {
                        stream.secs = 0;
                    } else {
                        var remainingsecsMsg = {
                            "payload": timerremain(stream.secs)
                        };
                        if (node.config.handle === 'each' && node.config.streamProperty) {
                            RED.util.setMessageProperty(remainingsecsMsg, node.config.streamProperty, id);
                        } else if (node.config.topic !== '') {
                            remainingsecsMsg.topic = node.config.topic;
                        }
                        node.send([null, remainingsecsMsg]);
                    }

                    checkWarning(stream, id);
                    activeCount++;
                } else if (stream.secs !== -1 && stream.secs <= 0.1) {
                    stopTimer(stream, id, true, "expired");
                }
            }
            updateStatus();
        });

        node.on("input", function(msg) {
            // Get property based on configuration
            var property = "payload";
            if (node.config.propertyType === "msg") {
                property = node.config.property || "payload";
            } else if (node.config.propertyType) {
                try {
                    property = RED.util.evaluateNodeProperty(node.config.property, node.config.propertyType, node);
                } catch(err) {
                    node.warn("Property expression error: " + err.message);
                    property = "payload";
                }
            }

            var streamId = "__default__";
            if (node.config.handle === 'each') {
                var streamProp = node.config.streamProperty || "topic";
                streamId = RED.util.getMessageProperty(msg, streamProp);
                if (streamId === undefined || streamId === null) {
                    streamId = "__default__";
                } else {
                    streamId = String(streamId);
                }
            }
            var stream = getStream(streamId);
            lastTriggeredStreamId = streamId;
            var propVal = msg[property];
            var propStr = typeof propVal === 'string' ? propVal.trim() : "";
            var isOperator = propStr.match(/^([<>])\s*(-?\d+(?:\.\d+)?)$/) !== null;
            var isMultiplier = propStr.match(/^\*\s*(\d+(?:\.\d+)?)$/) !== null;
            // Named commands only do something inside the control branch below; recognize them
            // here so "all messages are control" mode routes them there too (start/stop already
            // work via the else branch). Note: "reset" intentionally maps to the control-branch
            // reset (restart at GUI value), not the resetWhileRunning behavior of the else branch.
            var isCommand = /^(pause|reset|cancel|preload)$/i.test(propStr);
            if (msg.topic === "control" || (node.config.allMessagesWithInputDelayAreControl && (!isNaN(propVal) || isOperator || isMultiplier || isCommand))) {
                const opMatch = propStr.match(/^([<>])\s*(-?\d+(?:\.\d+)?)$/);
                if (opMatch) {
                    var op = opMatch[1];
                    var target = timeRebase(parseFloat(opMatch[2]));
                    target = applyMultiplier(target, stream);
                    var current = (stream.secs > 0) ? stream.secs : 0;
                    var newSecs = null;
                    if (op === '>') { if (current < target) newSecs = target; }
                    else            { if (current > target) newSecs = target; }
                    if (newSecs !== null) {
                        stream.secs = newSecs < 0 ? 0 : newSecs;
                        stream.timerPaused = false;
                        if (ticker) {
                            updateStatus();
                        } else if (stream.secs > 0 && node.config.startCountdownOnControlMessage) {
                            startTimer(true, stream, streamId, "control");
                        } else {
                            updateStatus();
                        }
                        checkWarning(stream, streamId);
                    }
                    return;
                }
                const multMatch = propStr.match(/^\*\s*(\d+(?:\.\d+)?)$/);
                if (multMatch) {
                    var newMult = parseFloat(multMatch[1]);
                    if (newMult > 0) {
                        if (stream.secs > 0) stream.secs = stream.secs * (newMult / stream.multiplier);
                        stream.multiplier = newMult;
                        if (ticker) updateStatus();
                        checkWarning(stream, streamId);
                    }
                    return;
                }

                if (!isNaN(propVal)) { //Strings containing valid number are 'numbers'...

                    // A zero value is a STOP, matching the plain-message STOP semantics
                    // (0 / "0" / false / "off" / "stop"). Without this, control-mode 0 would
                    // fall into the relative-adjust path below and add 0 (a no-op).
                    // Exclude signed-string zeros ("+0" / "-0"): those are relative offsets
                    // (possibly computed) and must stay no-ops, not stops.
                    var signedZeroStr = (typeof propVal === 'string') && (propStr.charAt(0) === '+' || propStr.charAt(0) === '-');
                    if (Number(propVal) === 0 && !signedZeroStr) {
                        stopTimer(stream, streamId);
                        return;
                    }

                    var numberValue = 0;
                    if (typeof msg[property] === 'string') {
                        const cleanedInput = msg[property].trim();
                        var signedString = false;

                        if (cleanedInput.startsWith('+') || cleanedInput.startsWith('-')) {
                            signedString = true;
                            numberValue = Number(cleanedInput);
                        }

                    } else { //Input is a true number
                        numberValue = msg[property];
                    }
                    if ((Number.isInteger(+numberValue) && (numberValue > 0)) && !signedString) {
                        timeout = applyMultiplier(timeRebase(numberValue), stream);
                    } else {
                        timeout = stream.secs + applyMultiplier(timeRebase(Math.trunc(numberValue)), stream);
                    }
                    //Make sure number is not less than zero...
                    stream.secs = timeout < 0 ? 0 : timeout;
                    stream.timerPaused = false;

                    if (ticker) {
                        // countdown is running
                        if (node.config.setTimeToNewWhileRunning) {
                            stream.secs = timeout;
                            checkWarning(stream, streamId);
                            updateStatus();
                        }
                    } else {
                        // countdown is stopped
                        if (node.config.startCountdownOnControlMessage) {
                            // Fix: use the timeout value from control message when starting
                            stream.secs = timeout;
                            startTimer(true, stream, streamId, "control");
                        } else {
                            updateStatus();
                        }
                    }
                } else {
                    if (msg[property] && typeof msg[property] === 'string') {
                        const cmd = msg[property].toLowerCase();
                        if (cmd === "cancel") {
                            stopTimer(stream, streamId, false, "cancelled");
                        }
                        if (cmd === "reset") {
                            startTimer(false, stream, streamId, "reset");
                        }
                        if (cmd === "pause") {
                            stream.timerPaused = !stream.timerPaused;
                            updateStatus();
                        }
                        if (cmd === "preload" && (stream.secs > 0) && (!ticker)) {
                            startTimer(true, stream, streamId, "preload");
                        }
                    }
                }
            } else {
                if (node.config.payloadTimerStopType === 'msg') {
                    var prop = RED.util.evaluateNodeProperty(node.config.payloadTimerStop, node.config.payloadTimerStopType, node);
                    if (msg.hasOwnProperty(prop)) {
                        stream.stopMsg = {
                            "payload": msg[prop]
                        };
                    } else {
                        node.warn("Property not set correctly Msg does not have " + prop);
                        stream.stopMsg = {
                            "payload": prop
                        };
                    }
                }
                if (ticker && node.config.resetWhileRunning) {
                    // startTimer reloads this stream from the GUI value and reuses the existing ticker.
                    startTimer(false, stream, streamId, "restart");
                }
                if (msg[property] === false || msg[property] === 0 || (msg[property] + "").toLowerCase() === "off"
                     || (msg[property] + "").toLowerCase() === "stop" || (msg[property] + "") === "0") {
                    stopTimer(stream, streamId);
                }
                else {
                  if (msg[property] === true || msg[property] === 1 || (msg[property] + "").toLowerCase() === "on"
                     || (msg[property] + "").toLowerCase() === "start" || (msg[property] + "") === "1") {
                    startTimer(false, stream, streamId);
                   }
                }
            }
        });

        node.on("close", function() {
            if (ticker) {
                clearInterval(ticker);
            }
        });
    }
    RED.nodes.registerType("countdown", countdown);
}
