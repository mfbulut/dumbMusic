const selectFolderBtn = document.getElementById('selectFolder');
const playlist = document.getElementById('playlist');
const tagList = document.getElementById('tagList');
const audio = document.getElementById('audio');
const playButton = document.getElementById('playButton');
const nextButton = document.getElementById('nextButton');
const prevButton = document.getElementById('prevButton');
const volumeSlider = document.getElementById('volumeSlider');
const likeButton = document.getElementById('likeButton');
const root = document.querySelector(':root');

playButton.addEventListener('click', () => playMusic(currentSongIndex));
nextButton.addEventListener('click', () => nextSong());
prevButton.addEventListener('click', () => prevSong());
volumeSlider.addEventListener('input', () => setVolume());
likeButton.addEventListener('click', () => toggleLike());

let currentSongIndex = -1;
let musicFiles = JSON.parse(localStorage.getItem('musicFiles')) || [];
let lastSong;
let queue = []
updateUI()

selectFolderBtn.addEventListener('click', async () => {
    try {
        const directoryHandle = await window.showDirectoryPicker();
        let newMusicFiles = await getMusicFilesInDirectory(directoryHandle);
        if (musicFiles !== []) {
            newMusicFiles = newMusicFiles.map(file => {
                const previousFile = musicFiles.find(prevFile => prevFile.name === file.name);
                if (previousFile) {
                    file.tags = [...new Set([...file.tags, ...previousFile.tags])];
                }
                return file;
            });
        }
        musicFiles = newMusicFiles;

        updateUI();
    } catch (error) {
        console.error('Error accessing folder or reading files:', error);
    }
});

async function getMusicFilesInDirectory(directoryHandle) {
    const musicFiles = [];
    for await (const entry of directoryHandle.values()) {
        const file = await entry.getFile();
        const tags = [file.name[0].toLowerCase()];
        musicFiles.push({
            file,
            name: file.name,
            tags,
        });
    }
    selectFolderBtn.remove();
    return musicFiles;
}

function updateUI() {
    playlist.innerHTML = '';
    tagList.innerHTML = '';
    const tagsSet = new Set();

    musicFiles.forEach((song) => {
        song.tags.forEach((tag) => {
            tagsSet.add(tag);
        });
    });

    const tagsArray = Array.from(tagsSet).sort();

    const tagItem = createTagItem('#');
    tagItem.addEventListener('click', () => updateUI());
    tagList.appendChild(tagItem);

    tagsArray.forEach((tag) => {
        const tagItem = createTagItem(tag);
        tagItem.addEventListener('click', () => filterByTag(tag));
        tagItem.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            playByTag(tag);
        });
        tagList.appendChild(tagItem);
    });

    musicFiles.forEach((file, index) => {
        const listItem = createListItem(file, index);
        playlist.appendChild(listItem);
    });

    localStorage.setItem('musicFiles', JSON.stringify(musicFiles));
}

function createTagItem(tag) {
    const tagItem = document.createElement('span');
    tagItem.innerHTML = tag;
    tagItem.className = 'tag-item';
    return tagItem;
}

function createListItem(file, index) {
    const container = document.createElement('div');
    container.addEventListener('click', () => playMusic(index));
    container.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        queue.push(index);
        if (queue.length === 1) {
            nextButton.title = musicFiles[queue[0]].name;
        }
    });


    const name = document.createElement('span');
    name.textContent = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    container.appendChild(name);

    const tags = document.createElement('span');
    tags.classList = "tag-list"

    if (musicFiles[index].tags) {
        musicFiles[index].tags.forEach((tag) => {
            if (tag.length > 1) {
                const tagName = document.createElement('span');
                tagName.addEventListener('click', () => filterByTag(tag));
                tagName.addEventListener("contextmenu", (e) => {
                    e.preventDefault();
                    musicFiles[index].tags = musicFiles[index].tags.filter((item) => {
                        return item !== tag
                    })
                    tagName.remove();
                    localStorage.setItem('musicFiles', JSON.stringify(musicFiles));
                });
                tagName.textContent = tag;
                tags.appendChild(tagName);
            }
        })
    }

    if (isSongLiked(file.name)) {
        const heartIcon = createHeartIcon();
        musicFiles[index].heart = heartIcon;
        tags.appendChild(heartIcon);
    }

    container.appendChild(tags);

    return container;
}

function playMusic(index) {
    lastSong = currentSongIndex;
    if (musicFiles[currentSongIndex])
        prevButton.title = musicFiles[currentSongIndex].name;

    if (index === currentSongIndex) {
        audio.paused ? audio.play() : audio.pause();
    } else if (index >= 0 && index < musicFiles.length) {
        currentSongIndex = index;
        const file = musicFiles[currentSongIndex].file;
        const blob = new Blob([file], { type: file.type });
        const objectURL = URL.createObjectURL(blob);
        audio.src = objectURL;
        audio.play();
        const musicNameElement = document.getElementById('musicName');
        musicNameElement.textContent = musicFiles[currentSongIndex].name.substring(0, musicFiles[currentSongIndex].name.lastIndexOf('.')) || musicFiles[currentSongIndex].name;
        audio.addEventListener('timeupdate', updateDuration);
        audio.onended = () => nextSong();
    }
}

function updateDuration() {
    const musicDurationElement = document.getElementById('musicDuration');
    const currentTime = audio.currentTime | 0;
    const totalDuration = audio.duration | 0;
    const currentMinutes = Math.floor(currentTime / 60) | 0;
    const currentSeconds = Math.floor(currentTime % 60) | 0;
    const totalMinutes = Math.floor(totalDuration / 60) | 0;
    const totalSeconds = Math.floor(totalDuration % 60) | 0;
    const formattedCurrentTime = `${currentMinutes}:${currentSeconds.toString().padStart(2, '0')}`;
    const formattedTotalDuration = `${totalMinutes}:${totalSeconds.toString().padStart(2, '0')}`;
    musicDurationElement.textContent = `${formattedCurrentTime} / ${formattedTotalDuration}`;
    root.style.setProperty('--duration', 100 * currentTime / totalDuration + '%');
}

function nextSong() {
    stopMusic();
    if (queue.length > 0) {
        playMusic(queue.shift());
        if (queue.length > 0) {
            nextButton.title = musicFiles[queue[0]].name;
        }
        else {
            nextButton.title = musicFiles[(currentSongIndex + 1) % musicFiles.length].name;
        }
    } else {
        playMusic((currentSongIndex + 1) % musicFiles.length);
        nextButton.title = musicFiles[(currentSongIndex + 1) % musicFiles.length].name;
    }
}

function prevSong() {
    stopMusic();
    if (lastSong) {
        playMusic(lastSong);
        lastSong = undefined;
        prevButton.title = "";
    }
    else {
        playMusic((currentSongIndex - 1 + musicFiles.length) % musicFiles.length);
    }
}

function stopMusic() {
    audio.pause();
    audio.currentTime = 0;
}

function setVolume() {
    audio.volume = volumeSlider.value / 100;
}

function isSongLiked(songId) {
    const likedSongs = JSON.parse(localStorage.getItem('likedsongs')) || [];
    return likedSongs.includes(songId);
}

function toggleLike() {
    const currentSongId = musicFiles[currentSongIndex].name;
    const likedSongs = JSON.parse(localStorage.getItem('likedsongs')) || [];
    const heartIcon = createHeartIcon();

    if (!likedSongs.includes(currentSongId)) {
        likedSongs.push(currentSongId);
        musicFiles[currentSongIndex].heart = heartIcon;
        playlist.children[currentSongIndex].children[1].appendChild(heartIcon);
    } else {
        const index = likedSongs.indexOf(currentSongId);
        if (index !== -1) {
            likedSongs.splice(index, 1);
            heartIcon.remove();
            musicFiles[currentSongIndex].heart.remove();
        }
    }

    localStorage.setItem('likedsongs', JSON.stringify(likedSongs));
}

function createHeartIcon() {
    const heartIcon = document.createElement('span');
    heartIcon.className = 'heart-icon';
    heartIcon.innerHTML = ' &#10084;';
    return heartIcon;
}

function filterByTag(tag) {
    playlist.innerHTML = '';
    musicFiles.forEach((file, index) => {
        if (file.tags.includes(tag)) {
            const listItem = createListItem(file, index);
            playlist.appendChild(listItem);
        }
    });
}

function playByTag(tag) {
    musicFiles.forEach((file, index) => {
        if (file.tags.includes(tag)) {
            queue.push(index);
        }
    });
}

const tagInput = document.getElementById('tagInput');

tagInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        addTagToCurrentSong();
    }
});

function addTagToCurrentSong() {
    const tagValue = tagInput.value.trim();
    if (tagValue) {
        const currentSong = musicFiles[currentSongIndex];
        if (!currentSong.tags.includes(tagValue)) {
            currentSong.tags.push(tagValue);
            updateUI();
            localStorage.setItem('musicFiles', JSON.stringify(musicFiles));
        }
        tagInput.value = '';
    }
}

