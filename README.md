# node-red-contrib-countdown-3000

`node-red-contrib-countdown-3000` is a simple countdown node for Node-Red.

This code is based on node-red-contrib-countdown-2 by marc, see here for the general description:

https://github.com/marc-gist/node-red-contrib-countdown

**JUL 2023: WORK IN PROGRESS. USE IN PRODUCTION AT YOUR OWN RISK**

This version is highly compatible with countdown-2 v1.4.2 with the following changes and fixes:

**Changes / Enhancements**

  - **STOP** command works - payload can be '0', 'off', 'stop', false or 0.
      -- Not case sensitive.
  - **START** command works - payload can be '1', 'on', 'start', true or 1.
      -- Not case sensitive.
     - Start will also cancel a paused count and begin again at the value set in
         the node's GUI interface. If you want to modify the count's start value,
         see the *preload* command below.

  - Node output and node status messages are in seconds or minutes
    to match node config.
  - Countdown goes to zero.
  - Minor syntax changes and code tidies.
  - 
    If any action makes the countdown zero or negative, it will be stopped at zero.

  - **"control"** input is now not case sensitive and can be a number or 
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
    - **PAUSE** will pause the countdown. The node will still output its current (paused) 
      value every second. The countdown will resume with the next pause input (in effect,
      'pause' toggles the counter), or if the countdown value is changed as above. 
    - **PRELOAD** will restart a count *at the current set value* (provided it's 
      not zero and the count is not currently running). This allows a count to be stopped, 
      a new value set and the count started from this value rather than the one set in 
      the node's interface. 

# Change Log

## 1.0.0
- Code forked from countdown-2 and bug fixes + enhancements applied.
