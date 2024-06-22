# Boomstream-dedrm

Boomstream video downloader. Works as plugin for chrome

## Installation

1) Obtain chrome extension from [release page](https://github.com/ega-forever/boomstream-dedrm/releases)
2) install extension to chrome 

## How does it work?
1) Once installed, the plugin ``boomstream-dedrm`` will appear among other extensions
2) Click on the plugin. Once clicked, ``boomstream-dedrm`` plugin will inject special script on the active browser's tab, 
which will listen for boomstream requests. 
3) The plugin will also inject the script to all other tabs for the same website
4) At the bottom of the web page (where script injected) you should see orange progress bar, which will tell download status
5) start playing the video and boomstream will start download progress
6) the plugin will download the ``playlist.m3u8`` file with all injected params (`IV`, `URI`) and then video file in ``.ts`` format
7) in case video download fail, you always can download video by yourself by using ``playlist.m3u8`` file and youtube-downloader util (or some other tool)

## How does it technically work?
1) plugin consists of 2 parts: inject script and background script
2) when plugin is activated - the background script listens for http requests
3) Once background script detects request for ``.m3u8`` - it will re-download this file and check if it's a playlist file. If so - this playlist then got cached 
4) at the next step, script will listen for request with subpath ``/process/``. This request should return the ``key`` for video decryption
5) After both requests (for obtaining playlist and key) were processed, the download process starts
6) During download, injected script on browser page, will start downloading chunks from the playlist file
7) Each chunk will then be decrypted and concatenated in one file
8) As chunks are in stream video format, the output file will be in ``.ts`` format

## What should I do with ts files?
1) the ts format can be played in VLC media player
2) the ts format can be converted to mp4 format with ffmpeg tool ``ffmpeg -i "video.ts" "video.mp4"``

# License

[MIT](LICENSE)

# Copyright

Copyright (c) 2024 Egor Zuev
