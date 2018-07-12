function getMsSinceMidnight(d) {
    let e = new Date(d);
    return d - e.setHours(0, 0, 0, 0);
}

module.exports = {
    signals: [{
        name: "time_ofday",
        description: "The number of seconds since midnight.",
        source: {
            type: "polling",
            interval: 1,
            poll: () => {
                return getMsSinceMidnight(new Date()) / 1000;
            }
        }
    }]
};