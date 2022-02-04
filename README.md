This is a standalone CalDAV web client. It is based on [fullcalendar][0] and
[ical.js][1] and inspired by [CalDavZAP][2].

# installation

Run `npm install` and then copy everything (including the `node_modules`
folder) to a server. You also need to set `rootUrl` in config.js to the URL of
the principal who's calendars should be displayed. It must be on the same
origin.

Note that this is only a client. You will also need a CalDAV server, e.g.
[baikal][3] or [radicale][4].

# architecture

We have to work with two different structures: The one defined by CalDAV and
the other one defined by fullcalendar.

In CalDAV there are calendars and events. In fullcalendar there are event
sources and events.

Each CalDAV calendar maps to a fullcalendar event source. `source.id` is the
URL of the CalDAV calendar.

Each CalDAV event maps to one or (for recurring events) more fullcalendar
events. `event.groupId` is the URL of the CalDAV event.
`event.extendedProps.comp` is the parsed ICS. `event.extendedProps.offset` is
the offset in seconds from the first instance to this one.

[0]: https://fullcalendar.io/
[1]: https://github.com/mozilla-comm/ical.js
[2]: https://inf-it.com/open-source/clients/caldavzap/
[3]: https://sabre.io/baikal/
[4]: https://radicale.org/
