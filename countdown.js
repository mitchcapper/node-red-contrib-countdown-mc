module.exports = function(RED) {
    "use strict";

    const isNumber = require('is-number');

    
    function countdown(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.config = config;

        // Local variables
        var ticker = null;
        var ticks = -1;
        var timeout = getTimeout();

        var stopMsg = {};

        this.status({ fill: "red", shape: "dot", text: "Stopped: " + timeout });

        function getTimeout() {
            if(node.config.minuteCounter) {
                return parseInt(node.config.timer) * 60;
            } else {
                return parseInt(node.config.timer);
            }
        }

        function runningMessage(ticks) {
            var t = ticks;
            var m = false;
            if(t / 60 > 1) {
                t = t / 60;
                t = t.toFixed(2);
                //node.warn("minute running: " + t);
                m = true;
            }
            var ret = "Running: " + t;
            if(m) {
                ret = ret + " minute(s)";
            } else {
                ret = ret + " second(s)";
            }
            return ret;
        }

        function startTimer() {
            timeout = timeout || getTimeout();
            ticks = timeout;

            // running status message
            node.status({
                fill: "green", shape: "dot", text: runningMessage(ticks)
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
                ticker = setInterval(function() { node.emit("TIX"); }, 1000);
            }
        }

        function stopTimer(output=true) {
            var tOutMsg = timeout + " sec";
            if(node.config.minuteCounter) {
                tOutMsg = parseInt(node.config.timer) + " min";
            }
            node.status({
                fill: "red", shape: "dot", text: "Stopped: " + tOutMsg
            });

            // Timer Message
            var msg = {}
            var cancel = false;
            if(output) {
                if(node.config.payloadTimerStopType === 'msg') {
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
            
            
            var remainingTicksMsg = { "payload": ticks, "cancled": cancel };

            // only send stop msg if type is not equal "send nothing" option
            if (node.config.payloadTimerStopType == "nul") {
                node.send([null, remainingTicksMsg]);
            } else {
                node.send([msg, remainingTicksMsg]);
            }

            endTicker();
        }

        function endTicker() {
            if (ticker) {
                clearInterval(ticker);
                ticker = null;
            }

            ticks = -1;
        }

        node.on("TIX", function() {
            if (ticks > 1) {
                ticks--;

                var remainingTicksMsg = { "payload": ticks };
                node.send([null, remainingTicksMsg]);
        
                // update Running status message
                node.status({
                    fill: "green", shape: "dot", text: runningMessage(ticks)
                });

            } else if (ticks == 1){
                stopTimer();

                ticks = 0;

            } else {
                // Do nothing
            }
        });

        node.on("input", function (msg) {
            if (msg.topic === "control") {
                if (isNumber(msg.payload) && msg.payload > 1) {
                    timeout = Math.ceil(msg.payload);

                    if (ticker) {
                        // countdown is running
                        if (node.config.setTimeToNewWhileRunning) {
                            ticks = msg.payload;
                            node.status({
                                fill: "green", shape: "dot", text: "Running: "+ timeout
                            });
                        }
                    } else {
                        // countdown is stopped
                        if (node.config.startCountdownOnControlMessage) {
                            startTimer();
                        } else {
                            node.status({
                                fill: "red", shape: "dot", text: "Stopped: "+ timeout
                            });
                        }
             
                    }
                } else {
                    if(msg.payload === "cancel") {
                        stopTimer(false);
                    }
                    if(msg.payload === "reset") {
                        startTimer();
                    }
                }
            } else {
                if(node.config.payloadTimerStopType === 'msg') {
                    var prop = RED.util.evaluateNodeProperty(node.config.payloadTimerStop, node.config.payloadTimerStopType, node);
                    if(msg.hasOwnProperty(prop)) {
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
                        startTimer();
                    }
                } else {
                    startTimer();
                }
                // if (msg.payload === false || msg.payload === 0) {
                //     stopTimer();
                // } else {
                //     if (ticker) {
                //         if (node.config.resetWhileRunning) {
                //             endTicker();
                //             startTimer();
                //         }
                //     } else {
                //         startTimer();
                //     }
                // }
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
