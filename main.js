var calendar = new FullCalendar.Calendar(
    document.querySelector('.calendar'),
    {
        schedulerLicenseKey: 'GPL-My-Project-Is-Open-Source',
        locale: navigator.language,
        scrollTime: '07:00',
        nowIndicator: true,
        weekNumberCalculation: 'ISO',
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
