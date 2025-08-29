/*
 Countdown-mc V2.0.0 29-Aug-2025 by Linker3000, Mitch Capper & contributors

 Based on node-red-contrib-countdown-2 V1.4.2 by Marc.

 Broad compatibility with the functions of countdown-2.

 No warranties, use at your own risk etc..

 No formal support.

 MIT Licence

Changes:

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

        // Local variables
        var ticker = null;
        var secs = -1;
        var timeUnit = node.config.timeUnit;
        var timeout = timeRebase(parseInt(node.config.timer));
        var timerPaused = false;
        var stopMsg = {};
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

            if (timerPaused) {displayValue = displayValue + " paused";}
            return displayValue;
        }

        function startTimer(preload) {
            if (!preload) {
                timeout = timeRebase(parseInt(node.config.timer));
                secs = timeout;
            }
            timerPaused = false;

            // running status message
            node.status({
                fill: "green",
                shape: "dot",
                text: 'Running:' + timerremain(secs)
            });

			// only send start msg if type is not equal "send nothing" option
            if (node.config.payloadTimerStartType !== "nul") {
				// Timer Message
				var msg = {}
				msg.payload = RED.util.evaluateNodeProperty(node.config.payloadTimerStart, node.config.payloadTimerStartType, node);
				if (node.config.topic !== '') {
					msg.topic = node.config.topic;
				}
                node.send([msg, null]);
            }

            if (!ticker) {
                // Use tickInterval variable that we've already defined earlier in the code
                ticker = setInterval(function() {
                    node.emit("TIX");
                }, tickInterval);
            }
        }

        function stopTimer(output = true) {
            node.status({
                fill: "red",
                shape: "dot",
                text: "Stopped: " + timerremain(timeRebase(parseInt(node.config.timer)))
            });

			// Timer Message
			// only send stop msg if type is not equal "send nothing" option
            if (node.config.payloadTimerStopType !== "nul") {
				var msg = {}
				var cancel = false;
				if (output) {
					if (node.config.payloadTimerStopType === 'msg') {
						msg = stopMsg;
					} else {
						msg.payload = RED.util.evaluateNodeProperty(node.config.payloadTimerStop, node.config.payloadTimerStopType, node);
					}
					if (node.config.topic !== '') {
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


                node.send([msg, remainingsecsMsg]);
            }

            endTicker();
        }

        function endTicker() {
            if (ticker) {
                clearInterval(ticker);
                ticker = null;
            }

            secs = -1;
        }

        node.on("TIX", function() {
            if (secs > 0.1) {
                if (!timerPaused) {
                    if (node.config.highPrecision) {
                        secs -= 0.1; // Decrement by 0.1 for high precision mode
                    } else {
                        secs -= 1; // Standard 1 second decrement
                    }
                }
				if (secs < 0) {
					secs = 0;
				} else { // we don't need to send a payload message if secs is zero as we will automatically send it in the stopTimer that will execute next
					var remainingsecsMsg = {
						"payload": timerremain(secs)
					};
					node.send([null, remainingsecsMsg]);
				}

                // update Running status message
                if (!timerPaused) {
                      node.status({
                      fill: "green",
                      shape: "dot",
                      text: timerremain(secs)
                   })
                } else {
                      node.status({
                      fill: "yellow",
                      shape: "ring",
                      text: "Paused: " + timerremain(secs)
                   })
                };

            } else if (secs <= 0.1) {
                stopTimer();
                secs = 0;

            } else {
                // Do nothing
            }
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

            if (msg.topic === "control" || (node.config.allMessagesWithInputDelayAreControl && ! isNaN(msg[property]) ) ) {

                if (!isNaN(msg[property])) { //Strings containing valid number are 'numbers'...

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
                        timeout = timeRebase(numberValue);
                    } else {
                        timeout = secs + timeRebase(Math.trunc(numberValue));
                    }

                    //Make sure number is not less than zero...
                    secs = timeout < 0 ? 0 : timeout;
                    timerPaused = false;

                    if (ticker) {
                        // countdown is running
                        if (node.config.setTimeToNewWhileRunning) {
                            secs = timeout;
                            node.status({
                                fill: "green",
                                shape: "dot",
                                text: "Running: " + timerremain(secs)
                            });
                        }
                    } else {
                        // countdown is stopped
                        if (node.config.startCountdownOnControlMessage) {
                            // Fix: use the timeout value from control message when starting
                            secs = timeout;
                            startTimer(true);
                        } else {
                            node.status({
                                fill: "red",
                                shape: "dot",
                                text: "Stopped: " + timerremain(secs)
                            });
                        }

                    }
                } else {
                    if (msg[property] && typeof msg[property] === 'string') {
                        const cmd = msg[property].toLowerCase();
                        if (cmd === "cancel") {
                            stopTimer(false);
                        }
                        if (cmd === "reset") {
                            startTimer(false);
                        }
                        if (cmd === "pause") {
                            timerPaused = !timerPaused;
                        }
                        if (cmd === "preload" && (secs > 0) && (!ticker)) {
                            startTimer(true);
                        }
                    }
                }
            } else {
                if (node.config.payloadTimerStopType === 'msg') {
                    var prop = RED.util.evaluateNodeProperty(node.config.payloadTimerStop, node.config.payloadTimerStopType, node);
                    if (msg.hasOwnProperty(prop)) {
                        stopMsg = {
                            "payload": msg[prop]
                        };
                    } else {
                        node.warn("Property not set correctly Msg does not have " + prop);
                        stopMsg = {
                            "payload": prop
                        };
                    }
                }
                if (ticker && node.config.resetWhileRunning) {
                    endTicker();
                    startTimer(false);
                }
                if (msg[property] === false || msg[property] === 0 || (msg[property] + "").toLowerCase() === "off"
                     || (msg[property] + "").toLowerCase() === "stop" || (msg[property] + "") === "0") {
                    stopTimer();
                }
                else {
                  if (msg[property] === true || msg[property] === 1 || (msg[property] + "").toLowerCase() === "on"
                     || (msg[property] + "").toLowerCase() === "start" || (msg[property] + "") === "1") {
                    startTimer(false);
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
