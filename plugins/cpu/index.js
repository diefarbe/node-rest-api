let os = require("os");

// note that this is the total utilization since boot
// getting the current utilization will require taking two spaced samples and subtracting them

let lastIdle = 0;
let lastTotal = 0;

let currentUsage = "nosignal";

function sampleUsage() {
    let cpus = os.cpus();

    let idle = 0;
    let total = 0;
    for (let i = 0, len = cpus.length; i < len; i++) {
        let cpu = cpus[i];

        for (let type in cpu.times) {
            total += cpu.times[type];
        }

        idle += cpu.times.idle;
    }
    
    if (lastTotal > 0) {
        let currentIdle = idle - lastIdle;
        let currentTotal = total - lastTotal;
        
        currentUsage = Math.floor((1 - currentIdle / currentTotal) * 100);
    }
    
    lastIdle = idle;
    lastTotal = total;
}

module.exports = {
    signalName: "cpu_utilization",
    signalValue: () => {
       sampleUsage();
       return currentUsage;
    }
};