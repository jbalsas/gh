/*
 * Copyright 2013, All Rights Reserved.
 *
 * Code licensed under the BSD License:
 * https://github.com/node-gh/gh/blob/master/LICENSE.md
 *
 * @author Zeno Rocha <zno.rocha@gmail.com>
 * @author Eduardo Lundgren <eduardolundgren@gmail.com>
 */

// -- Requires -------------------------------------------------------------------------------------

var async = require('async'),
    base = require('../base'),
    hooks = require('../hooks'),
    logger = require('../logger'),
    openUrl = require('open'),
    config = base.getConfig();

// -- Constructor ----------------------------------------------------------------------------------

function Issue(options) {
    this.options = options;

    if (!options.repo && !options.all) {
        logger.error('You must specify a Git repository to run this command');
    }
}

// -- Constants ------------------------------------------------------------------------------------

Issue.DETAILS = {
    alias: 'is',
    description: 'Provides a set of util commands to work with Issues.',
    iterative: 'number',
    commands: [
        'browser',
        'close',
        'comment',
        'list',
        'new',
        'open'
    ],
    options: {
        'all': Boolean,
        'assignee': String,
        'browser': Boolean,
        'close': Boolean,
        'comment': String,
        'detailed': Boolean,
        'label': String,
        'list': Boolean,
        'message': String,
        'milestone': Number,
        'new': Boolean,
        'number': [String, Array],
        'open': Boolean,
        'remote': String,
        'repo': String,
        'state': ['open', 'closed'],
        'title': String,
        'user': String
    },
    shorthands: {
        'a': ['--all'],
        'A': ['--assignee'],
        'B': ['--browser'],
        'C': ['--close'],
        'c': ['--comment'],
        'd': ['--detailed'],
        'L': ['--label'],
        'l': ['--list'],
        'm': ['--message'],
        'M': ['--milestone'],
        'N': ['--new'],
        'n': ['--number'],
        'o': ['--open'],
        'r': ['--repo'],
        'S': ['--state'],
        't': ['--title'],
        'u': ['--user']
    },
    payload: function(payload, options) {
        if (payload[0]) {
            options.new = true;
            options.title = options.title || payload[0];
            options.message = options.message || payload[1];
        }
        else {
            options.list = true;
        }
    }
};

Issue.STATE_CLOSED = 'closed';
Issue.STATE_OPEN = 'open';

// -- Commands -------------------------------------------------------------------------------------

Issue.prototype.run = function() {
    var instance = this,
        options = instance.options;

    options.state = options.state || Issue.STATE_OPEN;

    if (options.browser) {
        instance.browser(options.user, options.repo, options.number);
    }

    if (options.close) {
        hooks.invoke('issue.close', instance, function(afterHooksCallback) {
            options.state = Issue.STATE_CLOSED;

            logger.logTemplate(
                '{{prefix}} [info] Closing issue {{greenBright "#" options.number}} on {{greenBright options.user "/" options.repo}}', {
                    options: options
                });

            instance.close(function(err) {
                logger.defaultCallback(
                    err, null, logger.compileTemplate('{{issueLink}}', {
                        options: options
                    }));

                afterHooksCallback();
            });
        });
    }

    if (options.comment) {
        logger.logTemplate(
            '{{prefix}} [info] Adding comment on issue {{greenBright "#" options.number}}', {
                options: options
            });

        instance.comment(function(err) {
            logger.defaultCallback(
                err, null, logger.compileTemplate('{{issueLink}}', {
                    options: options
                }));
        });
    }

    if (options.list) {
        if (options.all) {
            logger.logTemplate(
                '{{prefix}} [info] Listing {{greenBright options.state}} issues for {{greenBright options.user}}', {
                    options: options
                });

            instance.listFromAllRepositories(function(err) {
                logger.defaultCallback(err, null, false);
            });
        }
        else {
            logger.logTemplate(
                '{{prefix}} [info] Listing {{greenBright options.state}} issues on {{greenBright options.user "/" options.repo}}', {
                    options: options
                });

            instance.list(options.user, options.repo, function(err) {
                logger.defaultCallback(err, null, false);
            });
        }
    }

    if (options.new) {
        hooks.invoke('issue.new', instance, function(afterHooksCallback) {
            logger.logTemplate(
                '{{prefix}} [info] Creating a new issue on {{greenBright options.user "/" options.repo}}', {
                    options: options
                });

            instance.new(function(err, issue) {
                if (issue) {
                    options.number = issue.number;
                }

                logger.defaultCallback(
                    err, null, logger.compileTemplate('{{issueLink}}', {
                        options: options
                    }));

                afterHooksCallback();
            });
        });
    }

    if (options.open) {
        hooks.invoke('issue.open', instance, function(afterHooksCallback) {
            logger.logTemplate(
                '{{prefix}} [info] Opening issue {{greenBright "#" options.number}} on {{greenBright options.user "/" options.repo}}', {
                    options: options
                });

            instance.open(function(err) {
                logger.defaultCallback(
                    err, null, logger.compileTemplate('{{issueLink}}', {
                        options: options
                    }));

                afterHooksCallback();
            });
        });
    }

};

Issue.prototype.browser = function(user, repo, number) {
    openUrl('https://github.com/' + user + '/' + repo + '/issues/' + number);
};

Issue.prototype.close = function(opt_callback) {
    var instance = this;

    instance.getIssue_(function(err, issue) {
        if (err) {
            opt_callback && opt_callback(err);
        }
        else {
            instance.editIssue_(issue.title, Issue.STATE_CLOSED, opt_callback);
        }
    });
};

Issue.prototype.comment = function(opt_callback) {
    var instance = this,
        options = instance.options,
        payload;

    options.comment = logger.applyReplacements(options.comment) + config.signature;

    payload = {
        body: options.comment,
        number: options.number,
        repo: options.repo,
        user: options.user
    };

    base.github.issues.createComment(payload, opt_callback);
};

Issue.prototype.editIssue_ = function(title, state, opt_callback) {
    var instance = this,
        options = instance.options,
        payload;

    options.label = options.label || [];

    payload = {
        labels: options.label,
        number: options.number,
        repo: options.repo,
        state: state,
        title: title,
        user: options.user
    };

    base.github.issues.edit(payload, opt_callback);
};

Issue.prototype.getIssue_ = function(opt_callback) {
    var instance = this,
        options = instance.options,
        payload;

    payload = {
        number: options.number,
        repo: options.repo,
        user: options.user
    };

    base.github.issues.getRepoIssue(payload, opt_callback);
};

Issue.prototype.list = function(user, repo, opt_callback) {
    var instance = this,
        options = instance.options,
        operations,
        payload;

    options.label = options.label || '';
    options.milestone = options.milestone || 'none';

    payload = {
        labels: options.label,
        milestone: options.milestone,
        repo: repo,
        sort: 'updated',
        state: options.state,
        user: user
    };

    if (options.assignee) {
        payload.assignee = options.assignee;
    }

    operations = [
        function(callback) {
            base.github.issues.repoIssues(payload, callback);
        }
    ];

    if (options.milestone === 'none') {
        operations.push(function(callback) {
            payload.milestone = '*';
            base.github.issues.repoIssues(payload, callback);
        });
    }

    async.parallel(operations, function(err, results) {
        if (err && !options.all) {
            logger.error(logger.getErrorMessage(err));
        }

        var issues = [];

        results.forEach(function(result) {
            if (result) {
                issues = issues.concat(result);
            }
        });

        issues.sort(function(a, b) {
            return a.number > b.number ? -1 : 1;
        });

        if (issues && issues.length > 0) {
            logger.logTemplateFile('issue.handlebars', {
                detailed: options.detailed,
                issues: issues,
                repo: repo,
                user: user
            });

            opt_callback && opt_callback(err, issues);
        }
    });
};

Issue.prototype.listFromAllRepositories = function(opt_callback) {
    var instance = this,
        options = instance.options,
        payload;

    payload = {
        type: 'all',
        user: options.user
    };

    base.github.repos.getAll(payload, function(err, repositories) {
        if (err) {
            opt_callback && opt_callback(err);
        }
        else {
            repositories.forEach(function(repository) {
                instance.list(repository.owner.login, repository.name, opt_callback);
            });
        }
    });
};

Issue.prototype.new = function(opt_callback) {
    var instance = this,
        options = instance.options,
        payload;

    if (options.message) {
        options.message = logger.applyReplacements(options.message);
    }

    if (options.label) {
        options.label = options.label.split(',');
    }
    else {
        options.label = [];
    }

    payload = {
        assignee: options.assignee,
        body: options.message,
        repo: options.repo,
        title: options.title,
        user: options.user,
        labels: options.label
    };

    base.github.issues.create(payload, opt_callback);
};

Issue.prototype.open = function(opt_callback) {
    var instance = this;

    instance.getIssue_(function(err, issue) {
        if (err) {
            opt_callback && opt_callback(err);
        }
        else {
            instance.editIssue_(issue.title, Issue.STATE_OPEN, opt_callback);
        }
    });
};

exports.Impl = Issue;
