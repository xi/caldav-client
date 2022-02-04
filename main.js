import * as config from './config.js';
import * as dav from './dav.js';

var calendar = new FullCalendar.Calendar(
    document.querySelector('.calendar'),
    {
        schedulerLicenseKey: 'GPL-My-Project-Is-Open-Source',
        locale: navigator.language,
        scrollTime: '07:00',
        nowIndicator: true,
        weekNumberCalculation: 'ISO',
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
                source = null;
            } else if (!source && checkbox.checked) {
                addSource();
            }
        });

        addSource();
    });
});
