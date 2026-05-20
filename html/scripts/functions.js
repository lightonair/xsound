function sanitizeURL(url) {
    url = DOMPurify.sanitize(url);
    return url.replace(/<[^>]*>?/gm, '');
}

function getYoutubeUrlId(url) {
    let videoId = "";
    if (url.indexOf("youtube") !== -1) {
        let urlParts = url.split("?v=");
        videoId = urlParts[1].substring(0, 11);
    }

    if (url.indexOf("youtu.be") !== -1) {
        let urlParts = url.replace("//", "").split("/");
        videoId = urlParts[1].substring(0, 11);
    }
    return videoId;
}

function isYoutubeURL(url) {
    return getYoutubeUrlId(url) !== "";
}

function getSoundCloudUrl(url) {
    if (url.indexOf("soundcloud.com") !== -1) {
        return url;
    }
    return "";
}

function isSoundCloudURL(url) {
    return getSoundCloudUrl(url) !== "";
}

function getDurationOfMusicFromURL(url, timeStamp) {
    url = sanitizeURL(url);

    if (isSoundCloudURL(url)) {
        const probeId = "sc_probe_" + Date.now();
        const iframe = document.createElement("iframe");
        iframe.id = probeId;
        iframe.src = "https://w.soundcloud.com/player/?url=" + encodeURIComponent(url) + "&auto_play=false";
        iframe.style.display = "none";
        document.body.appendChild(iframe);
        const widget = SC.Widget(iframe);
        widget.bind(SC.Widget.Events.READY, () => {
            widget.getCurrentSound((sound) => {
                document.body.removeChild(iframe);
                timeStamp(sound ? sound.duration / 1000 : null);
            });
        });
    } else if (isYoutubeURL(url)) {
        let ytPlayer = new YT.Player("trash", {
            height: '0',
            width: '0',
            videoId: getYoutubeUrlId(url),
            events: {
                'onReady': function (event) {
                    timeStamp(event.target.getDuration());
                    ytPlayer.stopVideo();
                    ytPlayer.destroy();
                    ytPlayer = null;
                },
                'onError': function (event) {
                    timeStamp(null);
                    ytPlayer.destroy();
                    ytPlayer = null;
                },
            }
        });
    } else {
        let audioPlayer = new Howl({
            src: [ url ],
            loop: false,
            html5: true,
            autoplay: false,
            volume: 0.00,
            format: [ 'mp3' ],
            onload: () => {
                timeStamp(audioPlayer.duration());
                audioPlayer.unload();
                audioPlayer = null;
            },
            onloaderror: (id, error) => {
                timeStamp(null);
                audioPlayer.unload();
                audioPlayer = null;
            },
        });
    }
}

function isReady(soundName) {
    const sound = soundList[soundName];
    if (sound == null) {
        return;
    }
    if (sound.loaded() == false) {
        sound.setLoaded(true);

        $.post('https://xsound/events', JSON.stringify({
            type: "onPlay",
            id: sound.getName(),
        }));

        if (sound.isAudioYoutubePlayer()) {
            sound.setYoutubePlayerReady(true);
        }

        if (sound.isAudioSoundCloudPlayer()) {
            sound.setSoundCloudReady(true);
        }

        if (sound.isDynamic()) {
            addToCache();
            updateVolumeSounds();
        } else {
            sound.setVolume(sound.getVolume())
        }
    }
}

function ended(soundName) {
    const sound = soundList[soundName];
    if (sound == null) {
        return;
    }
    if (!sound.isPlaying()) {
        if (sound.isLoop()) {
            const time = sound.getAudioCurrentTime();

            sound.setTimeStamp(0);
            sound.play();

            $.post('https://xsound/events', JSON.stringify({
                type: "resetTimeStamp",
                id: sound.getName(),
                time: time,
            }));
        }

        $.post('https://xsound/data_status', JSON.stringify({
            type: "finished",
            id: soundName
        }));
        $.post('https://xsound/events', JSON.stringify({
            type: "onEnd",
            id: sound.getName(),
        }));
    }
}

function sendMaxDurationToClient(item) {
    if (!item.hasMaxTime || !item.dynamic) {
        getDurationOfMusicFromURL(item.url, function (time) {
            if (time) {
                $.post('https://xsound/data_status', JSON.stringify({
                    time: time,
                    type: "maxDuration",
                    id: item.name,
                }));
            }
        });
    }
}