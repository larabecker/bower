var Q = require('q');
var mout = require('mout');

var analytics = module.exports;

var insight;

// use this to track whether to enable analytics for each session
// instead of writing out to .bowerrc in case if user uses a temp env var
var sessionAnalytics = false;


// Insight takes long to load, and often causes problems
// in non-interactive environment, so we load it lazily
function ensureInsight () {
    if (!insight) {
        var Insight = require('insight');
        var pkg = require('../../package.json');
        insight = new Insight({
            trackingCode: 'UA-43531210-1',
            packageName: pkg.name,
            packageVersion: pkg.version
        });
    }
}

// Initializes the application-wide insight singleton and asks for the
// permission on the CLI during the first run.
analytics.setup = function setup (config) {
    var deferred = Q.defer();

    // if `analytics` hasn't been explicitly set
    if (config.analytics == null) {
        ensureInsight();

        // if there is a stored value
        if (insight.optOut !== undefined) {
            // set analytics to the stored value
            sessionAnalytics = !insight.optOut;
            deferred.resolve(sessionAnalytics);
        } else {
            if (config.interactive) {
                insight.askPermission(null, function(err, optIn) {
                    // optIn callback param was exactly opposite before 0.4.3
                    // so we force at least insight@0.4.3 in package.json
                    sessionAnalytics = optIn;
                    deferred.resolve(sessionAnalytics);
                });
            } else {
                // no specified value, no stored value, and can't prompt for one
                // most likely CI environment; defaults to false to reduce data noise
                deferred.resolve(sessionAnalytics);
            }
        }
    } else {
        // use the specified value
        sessionAnalytics = config.analytics;
        deferred.resolve(sessionAnalytics);
    }

    return deferred.promise;
};

var Tracker = analytics.Tracker = function Tracker() {
    if (!sessionAnalytics) {
        this.track = function noop() {};
    }
};

Tracker.prototype.track = function track() {
    ensureInsight();

    insight.track.apply(insight, arguments);
};

Tracker.prototype.trackDecomposedEndpoints = function trackDecomposedEndpoints(command, endpoints) {
    endpoints.forEach(function (endpoint) {
        this.track(command, endpoint.source, endpoint.target);
    }.bind(this));
};

Tracker.prototype.trackPackages = function trackPackages(command, packages) {
    mout.object.forOwn(packages, function (package) {
        var meta = package.pkgMeta;
        this.track(command, meta.name, meta.version);
    }.bind(this));
};

Tracker.prototype.trackNames = function trackNames(command, names) {
    names.forEach(function (name) {
        this.track(command, name);
    }.bind(this));
};
