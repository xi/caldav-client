var networkIndicator = document.querySelector('.network-indicator');
var activeRequests = 0;

var _fetch = function(url, options) {
    activeRequests += 1;
    networkIndicator.hidden = false;

    var p = fetch(url, options);

    p.finally(() => {
        activeRequests -= 1;
        networkIndicator.hidden = activeRequests === 0;
    });

    return p;
};

var uuid = function() {
    if (crypto.randomUUID) {
        return crypto.randomUUID();
    }

    var rnds = new Uint8Array(16);
    crypto.getRandomValues(rnds);
    rnds[6] = (rnds[6] & 0x0f) | 0x40;
    rnds[8] = (rnds[8] & 0x3f) | 0x80;

    var s = '';
    for (var i = 0; i < 16; i++) {
        s += (rnds[i] + 0x100).toString(16).substr(1);
        if (i == 3 || i == 5 || i == 7 || i == 9) {
            s += '-';
        }
    }
    return s;
};

var date2idate = function(date, allDay, offset) {
    var odate = offset ? new Date(date - offset) : date;
    var idate = ICAL.Time.fromJSDate(odate);
    if (allDay) {
        idate.hour = 0;
        idate.minute = 0;
        idate.second = 0;
        idate.isDate = true;
    }
    return idate;
};

var formatDate = function(date) {
    return date
        .toISOString()
        .replace(/[-:.]/g, '')
        .replace('000Z', 'Z');
};

export var getCalendars = function(url) {
    return _fetch(url, {
        method: 'PROPFIND',
        credentials: 'same-origin',
        body: '<?xml version="1.0" encoding="utf-8"?>\n'
            + '<D:propfind xmlns:D="DAV:">\n'
            + '  <D:prop>\n'
            + '    <D:resourcetype/>\n'
            + '    <D:displayname/>\n'
            + '    <A:calendar-color xmlns:A="http://apple.com/ns/ical/"/>\n'
            + '  </D:prop>\n'
            + '</D:propfind>',
    }).then(function(response) {
        if (response.ok) {
            return response.text();
        } else {
            throw response;
        }
    }).then(function(xml) {
        var parser = new DOMParser();
        var dom = parser.parseFromString(xml, 'text/xml');
        var calendars = [];
        dom.querySelectorAll('response').forEach(response => {
            if (response.querySelector('resourcetype calendar')) {
                calendars.push({
                    href: response.querySelector('href').textContent,
                    name: response.querySelector('displayname').textContent,
                    color: response.querySelector('calendar-color').textContent,
                });
            }
        });
        return calendars;
    });
};

export var getEvents = function(href, info) {
    return _fetch(href, {
        method: 'REPORT',
        credentials: 'same-origin',
        headers: {depth: '1'},
        body: '<?xml version="1.0" encoding="utf-8"?>\n'
            + '<L:calendar-query xmlns:L="urn:ietf:params:xml:ns:caldav">\n'
            + '  <D:prop xmlns:D="DAV:">\n'
            + '    <D:getcontenttype/>\n'
            + '    <D:getetag/>\n'
            + '    <L:calendar-data/>\n'
            + '  </D:prop>\n'
            + '  <L:filter>\n'
            + '    <L:comp-filter name="VCALENDAR">\n'
            + '      <L:comp-filter name="VEVENT">\n'
            + `        <L:time-range start="${formatDate(info.start)}" end="${formatDate(info.end)}"/>\n`
            + '      </L:comp-filter>\n'
            + '    </L:comp-filter>\n'
            + '  </L:filter>\n'
            + '</L:calendar-query>',
    }).then(function(response) {
        if (response.ok) {
            return response.text();
        } else {
            throw response;
        }
    }).then(function(xml) {
        var parser = new DOMParser();
        var dom = parser.parseFromString(xml, 'text/xml');
        var events = [];
        dom.querySelectorAll('response').forEach(response => {
            // https://github.com/mozilla-comm/ical.js/wiki
            var ics = response.querySelector('calendar-data').textContent;
            var jcal = ICAL.parse(ics);
            var comp = new ICAL.Component(jcal);
            var vevent = new ICAL.Event(comp.getFirstSubcomponent('vevent'));
            var iter = vevent.iterator();
            var start = vevent.startDate.toJSDate();
            var end = vevent.endDate.toJSDate();
            var i;
            while (i = iter.next()) {
                var istart = i.toJSDate();
                if (istart < info.start) {
                    continue;
                } else if (istart > info.end) {
                    break;
                }
                events.push({
                    groupId: response.querySelector('href').textContent,
                    title: vevent.summary,
                    offset: istart - start,
                    start: istart,
                    end: new Date(istart - (start - end)),
                    allDay: vevent.startDate.isDate,
                    comp: comp,
                });
            }
        });
        return events;
    });
};

export var createEvent = function(info, source) {
    var comp = new ICAL.Component(['vcalendar', [], []]);
    var compEvent = new ICAL.Component('vevent');
    comp.updatePropertyWithValue('prodid', '-//iCal.js Wiki Example');
    comp.addSubcomponent(compEvent);

    var vevent = new ICAL.Event(compEvent);
    vevent.uid = uuid();

    return {
        groupId: source.id + vevent.uid + '.ics',  // FIXME: assumptions about href structure
        title: 'new event',
        offset: 0,
        start: info.date,
        allDay: info.allDay,
        comp: comp,
    };
};

export var commitEvent = function(data) {
    var comp = data.extendedProps.comp;
    var vevent = new ICAL.Event(comp.getFirstSubcomponent('vevent'));
    vevent.summary = data.title;
    vevent.startDate = date2idate(data.start, data.allDay, data.extendedProps.offset);
    vevent.endDate = date2idate(data.end || data.start, data.allDay, data.extendedProps.offset);
    return _fetch(data.groupId, {
        method: 'PUT',
        credentials: 'same-origin',
        body: comp.toString(),
    });
};

export var deleteEvent = function(data) {
    return _fetch(data.groupId, {
        method: 'DELETE',
        credentials: 'same-origin',
    });
};
