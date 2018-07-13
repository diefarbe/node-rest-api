module.exports = {
    signals: [{
        name: "something",
        tags: [],
        source: {
            type: "polling",
            interval: 1,
            poll: () => {
                return 10;
            }
        }
    }]
};