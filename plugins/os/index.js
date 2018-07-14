let os = require("os");

// TODO this is not a standard package, include this separately
let si = require("systeminformation");

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

let lastIdleMax = [];
let lastTotalMax = [];

let currentUsageMax = "nosignal";

function sampleUsageMax() {
    let cpus = os.cpus();

    let idle = [];
    let total = [];
    let record = "nosignal";
    for (let i = 0; i < cpus.length; i++) {
        let cpu = cpus[i];

        total[i] = 0;
        for (let type in cpu.times) {
            total[i] += cpu.times[type];
        }

        idle[i] = cpu.times.idle;

        if (lastTotalMax.length > 0) {
            let currentIdle = idle[i] - lastIdleMax[i];
            let currentTotal = total[i] - lastTotalMax[i];
            record = Math.max(record === "nosignal" ? 0 : record, Math.floor((1 - currentIdle / currentTotal) * 100));
        }
    }
    
    currentUsageMax = record;

    lastIdleMax = idle;
    lastTotalMax = total;
}

module.exports = {
    signals: [{
        name: "cpu_utilization",
        description: "The amount of CPU used from 0-100.",
        tags: [],
        source: {
            type: "polling",
            interval: 1,
            poll: () => {
                sampleUsage();
                return currentUsage;
            }
        }
    }, {
        name: "cpu_utilization_max",
        description: "The amount of CPU used from 0-100 for the highest used CPU.",
        tags: [],
        source: {
            type: "polling",
            interval: 1,
            poll: () => {
                sampleUsageMax();
                return currentUsageMax;
            }
        }
    }, {
        name: "memory_utilization",
        description: "The amount of memory used from 0-100.",
        tags: [],
        source: {
            type: "pollingCallback",
            interval: 1,
            poll: (callback) => {
                si.mem(data => {
                    callback((1 - data.available / data.total) * 100)
                });
            }
        }
    }]
};