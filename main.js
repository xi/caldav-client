import * as config from './config.js';
import * as dav from './dav.js';

var selectedEvent = null;
var form = document.querySelector('form');

var translations = {
    'de': {
        'Title': 'Titel',
        'All day': 'Ganzer Tag',
        'Start': 'Anfang',
        'End': 'Ende',
        'Calendar': 'Kalender',
        'Save': 'Speichern',
        'Delete': 'Löschen',
        'Cancel': 'Abbrechen',
        'Are you sure you want to delete this?': 'Bist du sicher dass du das löschen willst?',
    },
};

var _ = function(s) {
    var lang = translations[navigator.language] || {};
    return lang[s] || s;
};

var openForm = function(event) {
    form.reset();
    form.title.value = event.title;
    form.allday.checked = event.allDay;
    form.start.value = ICAL.Time.fromJSDate(event.start).toString();
    if (event.end) {
        form.end.value = ICAL.Time.fromJSDate(event.end).toString();
    }
    form.calendar.value = event.source.id;
    selectedEvent = event;
    form.hidden = false;
    calendar.render();
};

var closeForm = function() {
    selectedEvent = null;
    form.hidden = true;
    form.reset();
    calendar.render();
};

form.querySelectorAll('[data-translate]').forEach(el => {
    el.textContent = _(el.textContent);
});

form.addEventListener('submit', function(e) {
    e.preventDefault();
    var data = selectedEvent;  // selectedEvent could be reset in the meantime

    if (e.submitter.value === 'delete') {
        if (!confirm(_('Are you sure you want to delete this?'))) {
            return;
        }
        calendar.getEvents()
            .filter(rel => rel.groupId === data.groupId)
            .forEach(rel => rel.remove());
        dav.deleteEvent(data.groupId);
        closeForm();
    } else if (e.submitter.value === 'save') {
        data.setProp('title', form.title.value);
        data.setDates(
            form.start.value,
            form.end.value || null,
            {allDay: form.allday.checked}
        );

        if (form.calendar.value == data.source.id) {
            dav.commitEvent(data);
        } else {
            var newSource = calendar.getEventSourceById(form.calendar.value);
            var newData;

            calendar.getEvents()
                .filter(rel => rel.groupId === data.groupId)
                .forEach(rel => {
                    var plain = rel.toPlainObject();
                    plain.groupId = plain.groupId.replace(data.source.id, newSource.id);
                    rel.remove();
                    newData = calendar.addEvent(plain, newSource);
                });

            dav.commitEvent(newData);
            dav.deleteEvent(data.groupId);
        }
        closeForm();
    } else if (e.submitter.value === 'cancel') {
        closeForm();
    }
});

var calendar = new FullCalendar.Calendar(
    document.querySelector('.calendar'),
    Object.assign({
        schedulerLicenseKey: 'GPL-My-Project-Is-Open-Source',
        locale: navigator.language,
        nowIndicator: true,
        eventClick: info => openForm(info.event),
        dateClick: (function() {
            var timeout = null;
            return info => {
                closeForm();
                if (timeout) {
                    var source = calendar.getEventSources()[0];
                    var data = calendar.addEvent(dav.createEvent(info, source), source);
                    dav.commitEvent(data);
                    openForm(data);

                    clearTimeout(timeout);
                    timeout = null;
                } else {
                    timeout = setTimeout(() => {
                        timeout = null;
                    }, 500);
                }
            };
        })(),
        eventDrop: info => {
            closeForm();
            dav.commitEvent(info.event).catch(() => info.revert());
        },
        eventResize: info => {
            closeForm();
            dav.commitEvent(info.event).catch(() => info.revert());
        },
        eventDidMount: info => {
            info.el.title = info.event.title;
        },
        height: '100%',
        headerToolbar: {
            left: 'timeGridWeek,dayGridMonth',
            center: 'title',
            right: 'today prev,next',
        },
        initialView: 'timeGridWeek',
    }, config.calendarOptions)
);
calendar.render();

dav.getCalendars(config.rootUrl).then(calendars => {
    calendars.forEach(cal => {
        var source = null;

        var el = document.createElement('label');
        var checkbox = document.createElement('input');
        var circle = document.createElement('span');
        checkbox.type = 'checkbox';
        checkbox.checked = true;
        circle.className = 'fc-daygrid-event-dot';
        circle.style.borderColor = cal.color;
        el.append(checkbox);
        el.append(circle);
        el.append(cal.name);
        document.querySelector('.calendars').append(el);

        var option = document.createElement('option');
        option.textContent = cal.name;
        option.value = cal.href;
        form.calendar.add(option);

        var addSource = function() {
            source = calendar.addEventSource({
                id: cal.href,
                color: cal.color,
                editable: true,
                events: function(info, success, error) {
                    dav.getEvents(cal.href, info).then(success, error);
                },
            });
        };

        checkbox.addEventListener('change', function() {
            if (source && !checkbox.checked) {
                source.remove();
                option.hidden = true;
                source = null;
            } else if (!source && checkbox.checked) {
                addSource();
                option.hidden = false;
            }
        });

        addSource();
    });
});
