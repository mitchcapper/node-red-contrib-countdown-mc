/*
 Countdown-3000 V1.0 17-Jul-2023 by Linker3000
  
 Based on node-red-contrib-countdown-2 V1.4.2 by Marc.

 Broad compatibility with the functions of countdown-2.

 No warranties, use at your own risk etc..

 No formal support. 
  
 MIT Licence
  
 Fixes and changes/enhancements: 
  
  - STOP command works - payload can be '0', 'off', 'stop', false or 0.
      -- Not case sensitive.
  - START command works - payload can be '1', 'on', 'start', true or 1.
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

        // Local variables
        var ticker = null;
        var secs = -1;
        var timeout = timeRebase(parseInt(node.config.timer));
        var timeinmins = node.config.minuteCounter;
        var timerPaused = false;
        var stopMsg = {};

        this.status({
            fill: "red",
            shape: "dot",
            text: "INIT Stopped: " + timerremain(timeRebase(parseInt(node.config.timer)))
        });

        function timeRebase(timeinsecs) {
            if (timeinmins) {
                return (timeinsecs * 60);
            } else {
                return timeinsecs;
            }
        }

        function timerremain(secs) {
            var t = secs;

            if (timeinmins) {
                t = Math.floor(secs / 60) + ":" + (secs % 60).toString().padStart(2, '0');
            }

            var ret = t;
            if (timeinmins) {
                ret = ret + " min";
            } else {
                ret = ret + " sec";
            }
            if (timerPaused) {ret = ret + " paused";}
            return ret;
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

            // Timer Message
            var msg = {}
            msg.payload = RED.util.evaluateNodeProperty(node.config.payloadTimerStart, node.config.payloadTimerStartType, node);
            if (node.config.topic !== '') {
                msg.topic = node.config.topic;
            }

            // only send stop msg if type is not equal "send nothing" option
            if (node.config.payloadTimerStartType !== "nul") {
                node.send([msg, null]);
            }

            if (!ticker) {
                ticker = setInterval(function() {
                    node.emit("TIX");
                }, 1000);
            }
        }

        function stopTimer(output = true) {
            var tOutMsg = timeout + " sec";
            if (timeinmins) {
                tOutMsg = parseInt(node.config.timer) + " min";
            }
            node.status({
                fill: "red",
                shape: "dot",
                text: "Stopped: " + tOutMsg
            });

            // Timer Message
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

            // only send stop msg if type is not equal "send nothing" option
            if (node.config.payloadTimerStopType == "nul") {
                node.send([null, remainingsecsMsg]);
            } else {
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
            if (secs > 1) {
                if (!timerPaused) {secs--;}

                var remainingsecsMsg = {
                    "payload": timerremain(secs)
                };
                node.send([null, remainingsecsMsg]);

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

            } else if (secs <= 1) {
                stopTimer();
                secs = 0;

            } else {
                // Do nothing
            }
        });

        node.on("input", function(msg) {
            if (msg.topic === "control") {

                if (!isNaN(msg.payload)) { //Strings containing valid number are 'numbers'...

                    var numberValue = 0;

                    if (typeof msg.payload === 'string') {
                        const cleanedInput = msg.payload.trim();
                        var signedString = false;

                        if (cleanedInput.startsWith('+') || cleanedInput.startsWith('-')) {
                            signedString = true;
                            numberValue = Number(cleanedInput);
                        }

                    } else { //Input is a true number
                        numberValue = msg.payload;
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
                            startTimer(false);
                        } else {
                            node.status({
                                fill: "red",
                                shape: "dot",
                                text: "Stopped: " + timerremain(secs)
                            });
                        }

                    }
                } else {
                    if (msg.payload.toLowerCase() === "cancel") {
                        stopTimer(false);
                    }
                    if (msg.payload.toLowerCase() === "reset") {
                        startTimer(false);
                    }
                     if (msg.payload.toLowerCase() === "pause") {
                        timerPaused = !timerPaused;
                    }
                    if ((msg.payload.toLowerCase() === "preload")  && (secs > 0) && (!ticker)) {
                        startTimer(true);
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
                if (ticker) {
                    if (node.config.resetWhileRunning) {
                        endTicker();
                        startTimer(false);
                    }
                } else {
                    startTimer(false);
                }
                if (msg.payload === false || msg.payload === 0 || (msg.payload + "").toLowerCase() === "off" 
                     || (msg.payload + "").toLowerCase() === "stop" || (msg.payload + "") === "0") {
                    stopTimer();
                } 
                else {
                  if (msg.payload === true || msg.payload === 1 || (msg.payload + "").toLowerCase() === "on" 
                     || (msg.payload + "").toLowerCase() === "start" || (msg.payload + "") === "1") {
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
