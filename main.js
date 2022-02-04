import * as config from './config.js';
import * as dav from './dav.js';

var selectedEvent = null;
var form = document.querySelector('form');

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

form.addEventListener('submit', function(e) {
    e.preventDefault();

    if (e.submitter.value === 'delete') {
        if (!confirm('Are you sure you want to delete this?')) {
            return;
        }
        calendar.getEvents()
            .filter(rel => rel.groupId === selectedEvent.groupId)
            .forEach(rel => rel.remove());
        dav.deleteEvent(selectedEvent);
    } else if (e.submitter.value === 'save') {
        selectedEvent.setProp('title', form.title.value);
        selectedEvent.setDates(
            form.start.value,
            form.end.value || null,
            {allDay: form.allday.checked}
        );

        if (form.calendar.value == selectedEvent.source.id) {
            dav.commitEvent(selectedEvent);
        } else {
            var newSource = calendar.getEventSourceById(form.calendar.value);
            var newData;

            calendar.getEvents()
                .filter(rel => rel.groupId === selectedEvent.groupId)
                .forEach(rel => {
                    var plain = rel.toPlainObject();
                    plain.groupId = plain.groupId.replace(selectedEvent.source.id, newSource.id);
                    rel.remove();
                    newData = calendar.addEvent(plain, newSource);
                });

            dav.commitEvent(newData);
            dav.deleteEvent(selectedEvent);  // CAREFUL: must be called before selectedEvent is reset
        }
    }

    closeForm();
});

var calendar = new FullCalendar.Calendar(
    document.querySelector('.calendar'),
    {
        schedulerLicenseKey: 'GPL-My-Project-Is-Open-Source',
        locale: navigator.language,
        scrollTime: '07:00',
        nowIndicator: true,
        weekNumberCalculation: 'ISO',
        eventClick: info => openForm(info.event),
        eventDrop: info => dav.commitEvent(info.event),
        eventResize: info => dav.commitEvent(info.event),
        height: '100%',
        headerToolbar: {
            left: 'timeGridWeek,dayGridMonth',
            center: 'title',
            right: 'today prev,next',
        },
        initialView: 'timeGridWeek',
    }
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
