module.exports = {
    signals: [{
        name: "something",
        source: {
            type: "polling",
            interval: 1,
            poll: () => {
                return 10;
            }
        }
    }]
};