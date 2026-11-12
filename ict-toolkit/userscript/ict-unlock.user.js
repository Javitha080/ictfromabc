// ==UserScript==
// @name         ICT Unlock — Full Lesson Access + Video Toolkit
// @namespace    ict-toolkit.local
// @version      1.0.0
// @description  Surfaces every lesson the account can actually read, rewrites the site's entitlement fields so the native UI shows them as ALLOWED, and adds a panel with direct playback + ffmpeg/yt-dlp download commands.
// @author       operator
// @match        *://ictfromabc.com/*
// @match        *://www.ictfromabc.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  if (window.__ICT_UNLOCK__) return;
  if (!/(^|\.)ictfromabc\.com$/i.test(location.hostname)) return;
  window.__ICT_UNLOCK__ = true;

  // Injected by analysis/_build_unlock_assets.mjs. Shape:
  // { generatedAt, courseLabels:{id:label}, lessons:[{id,title,description,course_id,price,videos:[{id,title,description,media,video_url,token,expires}]}] }
  const DATA = {"generatedAt":"2026-11-12T08:51:40.017Z","account":{"phone":"REDACTED_PHONE","user_id":79787,"course_id":"2027-al"},"courseLabels":{"2027-al":"A/L 2027","2026-al":"A/L 2026","al-videos":"AL Video Modules","ol-videos":"OL Video Modules","git":"GIT","al-2028":"A/L 2028","al-2029":"A/L 2029","2025-ol":"O/L 2025 (GRADE 10)","2024-ol":"O/L 2024 (GRADE 11)","tute":"Lesson Wise Tutes","paper-book":"Past Paper Books","lesson-pp":"Lesson Wise Past Papers","lesson-pp-review":"Lesson Wise Past Paper Reviews","note":"Notes","lsn-map":"Lesson Maps"},"lessons":[{"id":151,"title":"SAGA Ticket + April Month Lesson - (Operating Systems + Introduction to ICT)","description":"2027 සිද්ධාන්ත සජීවී පන්තිය සෑම සඳුදාකම රාත්‍රී 7.00-9.00 දක්වා පැවැත්වේ. 2028 සිද්ධාන්ත සජීවී පන්තිය සෑම අඟහරුවාදාකම රාත්‍රී 7.00-9.00 දක්වා පැවැත්වේ. සජීවී විකාශය හෝ ඕනෑම වේලාවක පැමිණ නැවත විකාශය නැරඹිය හැකිය. මේ සමග 2026 අප්‍රේල් මස 30 වන දින (වෙසක් පොහෝ දිනට පෙර දින) දවස පුරා කොළඹ Havelock Sports Club ක්‍රීඩාංගනයේ හි පැවැත්වෙන අපගේ අවුරුදු උත්ස්වයට සහ සංගීත ප්‍රසංගයට සහභාගී වීමට ප්‍රවේශපතක් තැපැල් මගින් ලැබෙනු ඇත.","course_id":"2027-al","price":3000,"videos":[{"id":1106,"title":"2027 - Operating Systems - Day 04","description":"Disk Allocation Methods | External Fragmentation","media":{"kind":"youtube","videoId":"otshzyCU0Vo"},"video_url":"https://www.youtube.com/embed/otshzyCU0Vo?autoplay=0","token":"a59cc71eedbd10967d2470888db665fced117562c2df79ac944e3ae2caf41c96","expires":1794488191},{"id":1110,"title":"2028 - Introduction to ICT - Day 06","description":"Data Gathering | Validation | Input | Verification | Processing | Output | Storage","media":{"kind":"youtube","videoId":"EQ2tbWU5v1k"},"video_url":"https://www.youtube.com/embed/EQ2tbWU5v1k?autoplay=0","token":"9a7d750e473310d5740cbb3ad1e4705556de112911705b0d23dad348611974f3","expires":1794488192},{"id":1112,"title":"2025 ප්‍රතිඵල කතාව","description":"2025 ප්‍රතිඵල කතාව","media":{"kind":"youtube","videoId":"8JTkZgfrak0"},"video_url":"https://www.youtube.com/embed/8JTkZgfrak0?autoplay=0","token":"3e386978d7e267397fb967a9775e2d0b72ef178a0f35a95c9c9d8858dba46ce1","expires":1794488193},{"id":1131,"title":"2027 - Operating Systems - Day 05","description":"File Systems | Formatting | Backup | Recovery | Wipe | Partitioning | Fragmentation | Defragmentation | Compaction","media":{"kind":"bunny","libraryId":"415489","guid":"203d28db-13c8-4889-b005-905be3453c71","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/203d28db-13c8-4889-b005-905be3453c71/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/203d28db-13c8-4889-b005-905be3453c71?preload=false","token":"20625dbf7a43d2cfbd95f8022af9bf80f3b2dca7920bf56985b7666509e01ec7","expires":1794488199},{"id":1138,"title":"2027 - Operating Systems - Day 06","description":"Program | Process Management","media":{"kind":"bunny","libraryId":"415489","guid":"930786eb-bb11-411a-8fa2-a4fdc27f749e","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/930786eb-bb11-411a-8fa2-a4fdc27f749e/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/930786eb-bb11-411a-8fa2-a4fdc27f749e?preload=false","token":"cbe18f89cb8e9d63fdf810ef4c279a44b30138f3ecb5924e6b5f9f2def33416f","expires":1794488200},{"id":1155,"title":"2028 - Introduction to ICT - Day 07 Part 1","description":"Benefits of ICT | Social | Economic","media":{"kind":"bunny","libraryId":"619330","guid":"29c9f602-0ed7-407c-856d-1c3c3572c7e5","zone":"vz-842e9805-ddc","playlist":"https://vz-842e9805-ddc.b-cdn.net/29c9f602-0ed7-407c-856d-1c3c3572c7e5/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/619330/29c9f602-0ed7-407c-856d-1c3c3572c7e5?preload=false","token":"43f8b94971ed622b4938d4e025c4f4f3093e3b02ab9139682d31688c5636115b","expires":1794488202},{"id":1156,"title":"2028 - Introduction to ICT - Day 07 Part 2","description":"Drawbacks of ICT | DigitalDivide | Cyberbullying | CTS | CVS | RSI","media":{"kind":"bunny","libraryId":"619330","guid":"996d1775-7a74-4290-b7bb-94e7b8b8d569","zone":"vz-842e9805-ddc","playlist":"https://vz-842e9805-ddc.b-cdn.net/996d1775-7a74-4290-b7bb-94e7b8b8d569/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/619330/996d1775-7a74-4290-b7bb-94e7b8b8d569?preload=false","token":"0880f5331b3662c5ef0d7ecbef1b928b3c4e2e3b0a52db372697caa0f76a7962","expires":1794488206},{"id":1157,"title":"2028 - Introduction to ICT - Day 08","description":"Environmental Isssues | Ethical Issues | Privacy Issues | Legal Issues","media":{"kind":"bunny","libraryId":"619330","guid":"15342237-7c11-4000-a028-59c3c0a3ea83","zone":"vz-842e9805-ddc","playlist":"https://vz-842e9805-ddc.b-cdn.net/15342237-7c11-4000-a028-59c3c0a3ea83/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/619330/15342237-7c11-4000-a028-59c3c0a3ea83?preload=false","token":"df7ca0cdc25e416a6988e3543dadd7b8c5ee9b1ae3934e5813de928e35503dbe","expires":1794488215}]},{"id":148,"title":"March Month Lesson - (Operating Systems+ Introduction to ICT)","description":"2027 සිද්ධාන්ත සජීවී පන්තිය සෑම සඳුදාකම  රාත්‍රී 7.00-9.00 දක්වා පැවැත්වේ. 2028 සිද්ධාන්ත සජීවී පන්තිය සෑම අඟහරුවාදාකම රාත්‍රී 7.00-9.00 දක්වා පැවැත්වේ. සජීවී විකාශය හෝ ඕනෑම වේලාවක පැමිණ නැවත විකාශය නැරඹිය හැකිය.","course_id":"2027-al","price":3000,"videos":[{"id":1071,"title":"REVISION INTRODUCTION","description":"REVISION INTRODUCTION","media":{"kind":"youtube","videoId":"nSO6D5F76Hk"},"video_url":"https://www.youtube.com/embed/nSO6D5F76Hk?autoplay=0","token":"cd6dabfed266bed4f3132f91f177b16ca0b3dbe5e17a07b8c7aee3ff0ede0dae","expires":1794488217},{"id":1075,"title":"March Month Lesson - (Operating Systems+Lesson 01)","description":"March - Day 01","media":{"kind":"bunny","libraryId":"415489","guid":"704afaf1-0218-4913-acb5-1608a60a2901","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/704afaf1-0218-4913-acb5-1608a60a2901/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/704afaf1-0218-4913-acb5-1608a60a2901?preload=false","token":"9c1441726732e93b60151c2035749d2adb6c03b18f8239722164fc60c0f93421","expires":1794488229},{"id":1081,"title":"2027 - Operating Systems - Day 01","description":"Introduction | History","media":{"kind":"youtube","videoId":"lTFVcyVqGcQ"},"video_url":"https://www.youtube.com/embed/lTFVcyVqGcQ?autoplay=0","token":"2b2cc7929051fffe7de350011b3e6486b0862cf24e9c0a290c1717210d7e12ff","expires":1794488231},{"id":1086,"title":"2027 - Operating Systems - Day 02","description":"Classification | User Interfaces","media":{"kind":"bunny","libraryId":"415489","guid":"c692131d-7cab-4c2f-adae-bf92d03aa8d9","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/c692131d-7cab-4c2f-adae-bf92d03aa8d9/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/c692131d-7cab-4c2f-adae-bf92d03aa8d9?preload=false","token":"262cdc3af14f700ae96052dfcf10e8962acc8d5390942e1b39be26233cd60bb0","expires":1794488233},{"id":1092,"title":"2027 - Operating Systems - Day 03","description":"File Management - Files | Blocks | Internal Fragmentation | File Systems | Formatting | Directories","media":{"kind":"bunny","libraryId":"415489","guid":"cd1e3f3d-6e88-46d8-82bd-9365b14fc942","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/cd1e3f3d-6e88-46d8-82bd-9365b14fc942/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/cd1e3f3d-6e88-46d8-82bd-9365b14fc942?preload=false","token":"f58dbe3773ea23642be3e47c3b0caa73d99c385fb3a32201637b9d41554d4463","expires":1794488234},{"id":1113,"title":"2025 ප්‍රතිඵල කතාව","description":"2025 ප්‍රතිඵල කතාව","media":{"kind":"youtube","videoId":"8JTkZgfrak0"},"video_url":"https://www.youtube.com/embed/8JTkZgfrak0?autoplay=0","token":"c3efb2ae20dfaec02ee85eb3a39fc1d9db21b249c06b519ca275570a14d1de5d","expires":1794488236},{"id":1129,"title":"Operating Systems - Day 04","description":"Disk Allocation Methods | External Fragmentation","media":{"kind":"youtube","videoId":"otshzyCU0Vo"},"video_url":"https://www.youtube.com/embed/otshzyCU0Vo?autoplay=0","token":"e91970582ad10282e4b324f11df42bb2b5b4dc11d752b1b70f040fef0999a38d","expires":1794488243}]},{"id":144,"title":"February Month Lesson - Logic Gates","description":"සෑම සඳුදාකම රාත්‍රී 7.00 සිට 9.00 දක්වා සජීවීව පැවැත්වේ. සජීවී විකාශය හෝ ඕනෑම වේලාවක පැමිණ නැවත විකාශය නැරඹිය හැකිය.","course_id":"2027-al","price":3000,"videos":[{"id":1039,"title":"February Month Lesson - Logic Gates","description":"February Month Day 01 - Karnaugh Maps","media":{"kind":"youtube","videoId":"-fQmgYMYJPk"},"video_url":"https://www.youtube.com/embed/-fQmgYMYJPk?autoplay=0","token":"5e8cc5e471dd069406d53f7d910c9f474025431591bda5b8a8399f55c491233d","expires":1794488245},{"id":1049,"title":"February Month Lesson - Logic Gates","description":"February Month Day 02 - Adders","media":{"kind":"bunny","libraryId":"415489","guid":"e9a9444d-64f1-476d-addf-9824bcd9338f","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/e9a9444d-64f1-476d-addf-9824bcd9338f/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/e9a9444d-64f1-476d-addf-9824bcd9338f?preload=false","token":"2b32809dc65a116d4cd4b8b32be010555742ad1c98de7f1e0c28a9436d6425ca","expires":1794488247},{"id":1067,"title":"February Month Lesson - Logic Gates","description":"February Month - Day 03","media":{"kind":"bunny","libraryId":"415489","guid":"84d79ee2-df20-4d86-8d19-becdb26e6b6b","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/84d79ee2-df20-4d86-8d19-becdb26e6b6b/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/84d79ee2-df20-4d86-8d19-becdb26e6b6b?preload=false","token":"18cb5185e6929fd1bfebf73bdaa05b79e6dbc134e159240fb49caaa920af72ab","expires":1794488248}]},{"id":141,"title":"January Month Lesson - Logic Gates","description":"සෑම සඳුදාකම රාත්‍රී 7.00 සිට 9.00 දක්වා සජීවීව පැවැත්වේ. සජීවී විකාශය හෝ ඕනෑම වේලාවක පැමිණ නැවත විකාශය නැරඹිය හැකිය.","course_id":"2027-al","price":3000,"videos":[{"id":1009,"title":"January Month Lesson - Logic Gates","description":"January Month - Day 01","media":{"kind":"youtube","videoId":"Z3WTNk9rnRg"},"video_url":"https://www.youtube.com/embed/Z3WTNk9rnRg?autoplay=0","token":"31a23dfa40ab2bdd0d9c4d04dacb44b01e9c48175e49b2aafdd5a1849897efd4","expires":1794488250},{"id":1010,"title":"January Month Lesson - Logic Gate","description":"Simplifications using Boolean Laws","media":{"kind":"youtube","videoId":"bNUJqlvHuHo"},"video_url":"https://www.youtube.com/embed/bNUJqlvHuHo?autoplay=0","token":"9230735d194ad22b3f7593557a0ecbb461c275186c0e3072bc0f06fc1e1189d5","expires":1794488252},{"id":1026,"title":"January Month Lesson - Logic Gates","description":"January Month - Day 02","media":{"kind":"bunny","libraryId":"415489","guid":"1074cd28-1ed6-43c9-b6ca-3b9173c6be94","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/1074cd28-1ed6-43c9-b6ca-3b9173c6be94/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/1074cd28-1ed6-43c9-b6ca-3b9173c6be94/?autoplay=false&preload=false","token":"2b050cc925d344fc8e44449da755c81510b8994a468f65b86de99fd29aa0b8f5","expires":1794488254},{"id":1028,"title":"January Month Lesson - Logic Gates","description":"January Month - Day 03","media":{"kind":"bunny","libraryId":"415489","guid":"e9caac62-6a53-4b27-9cee-cf7efeede76d","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/e9caac62-6a53-4b27-9cee-cf7efeede76d/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/e9caac62-6a53-4b27-9cee-cf7efeede76d/?autoplay=false&preload=false","token":"ab8abe2d03ef4d34f49444c01028b1e89eabc5086813204ffe37051ac6e00ae5","expires":1794488255},{"id":1032,"title":"January Month Lesson - Logic Gates","description":"January Month - Day 04","media":{"kind":"bunny","libraryId":"415489","guid":"3fe84b59-5fe7-4d23-a438-7d4ecfec28aa","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/3fe84b59-5fe7-4d23-a438-7d4ecfec28aa/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/3fe84b59-5fe7-4d23-a438-7d4ecfec28aa/?autoplay=false&preload=false","token":"eaecd1f95df9db4ce9f8f9dd70f6a79c5cef665c4ec6284ae3406a5e9a19bc92","expires":1794488256}]},{"id":134,"title":"November Month Lesson - Number Systems Part 2","description":"සෑම සඳුදාකම රාත්‍රී 7.00 සිට 9.00 දක්වා සජීවීව පැවැත්වේ. සජීවී විකාශය හෝ ඕනෑම වේලාවක පැමිණ නැවත විකාශය නැරඹිය හැකිය.","course_id":"2027-al","price":3000,"videos":[{"id":953,"title":"2027 AL ICT Class","description":"Number Systems - Day 04","media":{"kind":"youtube","videoId":"2dIu5a1AENE"},"video_url":"https://www.youtube.com/embed/2dIu5a1AENE?autoplay=0","token":"72a3b58d83484a3bc3379b3d08c43d44323db788967a14ae73f7a0d550639342","expires":1794488260},{"id":958,"title":"2027 AL ICT Class","description":"Number Systems - Day 05 Part 01","media":{"kind":"bunny","libraryId":"415489","guid":"e639696a-e9da-4eb3-b504-692fc3ce18e2","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/e639696a-e9da-4eb3-b504-692fc3ce18e2/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/e639696a-e9da-4eb3-b504-692fc3ce18e2/?autoplay=false&preload=false","token":"8d5e4e65538ee003b06a604b3acd104236ceab30c4685d93677e7a14ba979cf0","expires":1794488266},{"id":959,"title":"2027 AL ICT Class","description":"Number Systems - Day 05 Part 02","media":{"kind":"bunny","libraryId":"415489","guid":"076712c8-66f9-43e0-abbb-31c6ed81fd0c","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/076712c8-66f9-43e0-abbb-31c6ed81fd0c/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/076712c8-66f9-43e0-abbb-31c6ed81fd0c/?autoplay=false&preload=false","token":"db3f4c56934a8b11f69d0bc1847cff2bfcdb31516bf0cec91ca7527dcf8ce088","expires":1794488268},{"id":961,"title":"Number Systems Part 2","description":"Day 06","media":{"kind":"bunny","libraryId":"415489","guid":"91ee25d1-20e1-4103-a127-16543f582b32","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/91ee25d1-20e1-4103-a127-16543f582b32/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/91ee25d1-20e1-4103-a127-16543f582b32/?autoplay=false&preload=false","token":"f015a744bb212dd7939381362d45056308125fad0bb6f7c7b08bccdf2f4208d7","expires":1794488269},{"id":971,"title":"2027 AL ICT Class","description":"Number Systems - Day 07","media":{"kind":"bunny","libraryId":"415489","guid":"c578cd8c-4be1-44d2-b755-be14640aedd0","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/c578cd8c-4be1-44d2-b755-be14640aedd0/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/c578cd8c-4be1-44d2-b755-be14640aedd0/?autoplay=false&preload=false","token":"8734bb0067fb57a36622415d9b55d7fd1d477e6a3f8896eb33fe8bf6a24507b7","expires":1794488271},{"id":975,"title":"2026 Revision","description":"2026 Revision","media":{"kind":"youtube","videoId":"nSO6D5F76Hk"},"video_url":"https://www.youtube.com/embed/nSO6D5F76Hk?autoplay=0","token":"22cedb2d55b18d58088e519ccc1ae605816df02365c3ca8023cbc2395c481a42","expires":1794488272},{"id":988,"title":"2026 Revision Day 1 (optional)","description":"2026 Revision Day 1 (optional)","media":{"kind":"youtube","videoId":"h93052p8bcY"},"video_url":"https://www.youtube.com/embed/h93052p8bcY?autoplay=0","token":"7255139584912d44d09e299e3ee178d9cc2ad1d744a0eef68366248d74f23d62","expires":1794488275}]},{"id":130,"title":"October Month Lesson - Number Systems","description":"සෑම සඳුදාකම රාත්‍රී 7.00 සිට 9.00 දක්වා සජීවීව පැවැත්වේ. සජීවී විකාශය හෝ ඕනෑම වේලාවක පැමිණ නැවත විකාශය නැරඹිය හැකිය.","course_id":"2027-al","price":3000,"videos":[{"id":929,"title":"2027 AL ICT Class","description":"Number Systems Day 01","media":{"kind":"bunny","libraryId":"415489","guid":"77b8e6a8-e09e-4535-bc65-6e0230b0633d","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/77b8e6a8-e09e-4535-bc65-6e0230b0633d/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/77b8e6a8-e09e-4535-bc65-6e0230b0633d/?autoplay=false&preload=false","token":"697320512570d10b1c959371d3fc614492e6401aaa4a7a4544fdf9e7a345fd29","expires":1794488281},{"id":940,"title":"AL ICT - Lesson 1 & 2 | 2011-2024 Pastpaper MCQ Discussion","description":"AL ICT - Lesson 1 & 2 | 2011-2024 Pastpaper MCQ Discussion","media":{"kind":"youtube","videoId":"smJOMATfxI4"},"video_url":"https://www.youtube.com/embed/smJOMATfxI4?autoplay=0","token":"2cbc106faf3341b5fe96d220702c1556cd6244344cbe00b2511218c354f50e40","expires":1794488282},{"id":949,"title":"2027 AL ICT Class","description":"Number Systems Day 02","media":{"kind":"bunny","libraryId":"415489","guid":"3e5fc681-af42-4a4c-adb4-a52baf958466","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/3e5fc681-af42-4a4c-adb4-a52baf958466/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/3e5fc681-af42-4a4c-adb4-a52baf958466/?autoplay=false&preload=false","token":"1ca9a648b3f445c00a98d13bddd6fe7329c8ee7136b66efd90245aa36b69ed6c","expires":1794488284},{"id":951,"title":"2027 AL ICT Class","description":"Number System - Day 03","media":{"kind":"bunny","libraryId":"415489","guid":"40b3336b-7e41-4eb7-a1da-af8ac6d70ffd","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/40b3336b-7e41-4eb7-a1da-af8ac6d70ffd/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/40b3336b-7e41-4eb7-a1da-af8ac6d70ffd/?autoplay=false&preload=false","token":"c6df83374f09f7904b6eceecbeb525a4d5585c387a12da234429ecdc0f349b05","expires":1794488286}]},{"id":123,"title":"September Month Lesson","description":"සෑම සඳුදාකම රාත්‍රී 7.00 සිට 9.00 දක්වා සජීවීව පැවැත්වේ. සජීවී විකාශය හෝ ඕනෑම වේලාවක පැමිණ නැවත විකාශය නැරඹිය හැකිය.","course_id":"2027-al","price":3000,"videos":[{"id":878,"title":"2027 AL ICT Class","description":"September Month - Day 01","media":{"kind":"youtube","videoId":"ZZLUlmFw9zE"},"video_url":"https://www.youtube.com/embed/ZZLUlmFw9zE??autoplay=0","token":"623643ac1433d7666f6a674014ec79eab366cb87c7e9ea35ab404d15d475e95e","expires":1794488340},{"id":881,"title":"2027 AL ICT Class","description":"September Month - Day 02","media":{"kind":"youtube","videoId":"FP7Slb9xJVY"},"video_url":"https://www.youtube.com/embed/FP7Slb9xJVY??autoplay=0","token":"438d30e53d921688a4313ac66ed337e4ac5968e5fcfd4b59acd24ed90129f652","expires":1794488342},{"id":884,"title":"2027 AL ICT Class","description":"September Month - Day 03","media":{"kind":"bunny","libraryId":"415489","guid":"a079ce92-25bf-419d-bdb9-e39400888bf0","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/a079ce92-25bf-419d-bdb9-e39400888bf0/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/a079ce92-25bf-419d-bdb9-e39400888bf0/?autoplay=false&preload=false","token":"7eb3460557263bbe01c6e8f98b5aa4a260fa76fa1c95d63ea2c67c0d3d23dc60","expires":1794488343},{"id":918,"title":"2027 AL ICT Class","description":"September Month - Day 04","media":{"kind":"bunny","libraryId":"415489","guid":"e9824828-dc0a-403c-85c9-deafac988964","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/e9824828-dc0a-403c-85c9-deafac988964/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/e9824828-dc0a-403c-85c9-deafac988964/?autoplay=false&preload=false","token":"d3365ffc2d8e696cc4841a0ac68d82713873d93191d22b5f60efe953eb36cb5c","expires":1794488345},{"id":922,"title":"2027 AL ICT Class","description":"Flow Charts with Python","media":{"kind":"youtube","videoId":"HQEkkYKUc2c"},"video_url":"https://www.youtube.com/embed/HQEkkYKUc2c??autoplay=0","token":"606a1a823d02010bfae37b85bb10cfb827b5b752768950a1dd45bb65d17cce07","expires":1794488346},{"id":923,"title":"2027 AL ICT Class","description":"Python Past Paper Questions Discussion - Part V","media":{"kind":"bunny","libraryId":"249724","guid":"4a89c44f-3b1e-429d-b442-07ca56db891b","playlistStatus":0,"playlistOk":false},"video_url":"https://iframe.mediadelivery.net/embed/249724/4a89c44f-3b1e-429d-b442-07ca56db891b/?autoplay=false&preload=false","token":"9cbcbb57594d5484fa158a20292f58ba2949d0cba7991cf391c247e2493c5db1","expires":1794488347},{"id":924,"title":"2027 AL ICT Class","description":"Python - Pseudocodes","media":{"kind":"bunny","libraryId":"249724","guid":"00c24b4a-0be5-41c6-91f5-5fb447297b90","playlistStatus":0,"playlistOk":false},"video_url":"https://iframe.mediadelivery.net/embed/249724/00c24b4a-0be5-41c6-91f5-5fb447297b90/?autoplay=false&preload=false","token":"ab25d90ff7184c5dc9c91ea44d55c6b93ef91b763a50e8472e289a83c3360607","expires":1794488348},{"id":927,"title":"2027 AL ICT Class","description":"September Month - Day 05","media":{"kind":"bunny","libraryId":"415489","guid":"77b8e6a8-e09e-4535-bc65-6e0230b0633d","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/77b8e6a8-e09e-4535-bc65-6e0230b0633d/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/77b8e6a8-e09e-4535-bc65-6e0230b0633d/?autoplay=false&preload=false","token":"9319d79d06c66be1531818ecbb4a2b992efcd53331f17ae4d7425cea58ab21e1","expires":1794488350},{"id":941,"title":"AL ICT - Lesson 1 & 2 | 2011-2024 Pastpaper MCQ Discussion","description":"AL ICT - Lesson 1 & 2 | 2011-2024 Pastpaper MCQ Discussion","media":{"kind":"youtube","videoId":"smJOMATfxI4"},"video_url":"https://www.youtube.com/embed/smJOMATfxI4?autoplay=0","token":"563f1ac1092ccfe689c9bb941bc6fd7147a5231f06d595803a5dfc31c07c357d","expires":1794488351}]},{"id":118,"title":"August Month Lesson - New Students (After OL Results)","description":"මෙම පාඩම සාමාන්‍ය පෙළ ප්‍රතිඵල පැමිණීමෙන් පසුව අගෝස්තු මාසයේ පන්තියට සම්බන්ධ වන නවක සිසුන් සඳහා පමණි. පසුගිය මාස වල ලබාදුන් නිබන්ධන 4ක් (පිටු 500) එකවර ලබාදීම සඳහා යන වියදම පියවා ගැනීමට මෙම විශේෂ ගාස්තුව අය කිරීමෙන් බලාපොරොත්තු වන අතර, ලබන මාසයේ සිට ඔවුන් සඳහාද සාමාන්‍ය පන්ති ගාස්තු අය කෙරේ. online පන්තිය සෑම සඳුදාම රාත්‍රී 7 සිට 9 දක්වා Zoom ඔස්සේ සජීවීව පැවැත්වේ. වැඩිදුර තොරතුරු දැනගැනීම සඳහා Telegram සමූහයට පිවිසෙන්න. මෙම පාඩමට ගෙවීම් කරන සියලු දෙනාට පසුගිය මගහැරුණු video සියල්ල ලබාදේ. ජූලි ම","course_id":"2027-al","price":6000,"videos":[{"id":818,"title":"2027-AL August Month Lesson - New Students (After OL Results)","description":"2027 AL ICT නව පන්ති ආරම්භය සහ විශය සම්බන්ධ දැනුම්වත් කිරීම","media":{"kind":"youtube","videoId":"RRIeYdUl04Y"},"video_url":"https://www.youtube.com/embed/RRIeYdUl04Y?autoplay=0","token":"901bd8143b3adcf92219e9314968b87776d1322000ffc0184e51ff5f2b490b19","expires":1794488369},{"id":819,"title":"2027-AL August Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 01 (ඉගැන්වීම් ආරම්භය පළමු දිනය)","media":{"kind":"youtube","videoId":"ZtkTS7KllVA"},"video_url":"https://www.youtube.com/embed/ZtkTS7KllVA?autoplay=0","token":"02af1d69d6e006fd0912bd76c57b510b00bdb9b9196da3fb94ec58caf5b447dc","expires":1794488371},{"id":820,"title":"2027-AL August Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 02 (2025.04.21)","media":{"kind":"bunny","libraryId":"249724","guid":"7b25f19a-4668-4d64-8234-c85dc07f06cf","playlistStatus":0,"playlistOk":false},"video_url":"https://iframe.mediadelivery.net/embed/249724/7b25f19a-4668-4d64-8234-c85dc07f06cf/?autoplay=false&preload=false","token":"3783821ba48cc26827b9e62927dcd23ece5cd519dbf2a095203193895878912c","expires":1794488380},{"id":821,"title":"2027-AL August Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 03 (2025.04.28)","media":{"kind":"bunny","libraryId":"415489","guid":"a4c3c3a4-19ec-4b83-95d2-755159331980","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/a4c3c3a4-19ec-4b83-95d2-755159331980/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/a4c3c3a4-19ec-4b83-95d2-755159331980/?autoplay=false&preload=false","token":"e25f78b0c990e35ebd01cfd03e11086d620c3257bbe2668afb83be10f2874599","expires":1794488382},{"id":822,"title":"2027-AL August Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 04 (2025/05/06)","media":{"kind":"youtube","videoId":"ETvOeEJ2uZ4"},"video_url":"https://www.youtube.com/embed/ETvOeEJ2uZ4?autoplay=0","token":"919ec4283661dc3712c09246098cf84c3785d5bb45c16f2a742c06c13de84059","expires":1794488384},{"id":824,"title":"2027-AL August Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 05 Part 1 (2025/05/19)","media":{"kind":"bunny","libraryId":"415489","guid":"2fdd3778-a4ea-4b09-a921-3088f07aedca","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/2fdd3778-a4ea-4b09-a921-3088f07aedca/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/2fdd3778-a4ea-4b09-a921-3088f07aedca/?autoplay=false&preload=false","token":"e221540c833babc661af9f68c04e74add4b5613b181151dfc75d882d4ff286c7","expires":1794488390},{"id":825,"title":"2027-AL August Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 05 Part 2 (2025/05/19)","media":{"kind":"bunny","libraryId":"415489","guid":"b54a48d1-5786-4570-b977-d0aaec29120f","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/b54a48d1-5786-4570-b977-d0aaec29120f/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/b54a48d1-5786-4570-b977-d0aaec29120f/?autoplay=false&preload=false","token":"bb8f9042bd55dc7dc93aa9f279ba3c4369eea8714dc31c430ca6153af818c058","expires":1794488391},{"id":826,"title":"2027-AL August Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 06 (2025/05/26)","media":{"kind":"bunny","libraryId":"415489","guid":"a0a71716-4da6-46d7-8940-44eb7b7447ce","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/a0a71716-4da6-46d7-8940-44eb7b7447ce/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/a0a71716-4da6-46d7-8940-44eb7b7447ce/?autoplay=false&preload=false","token":"20a133784bc6ff5d983ce0afdbd6829cd507c301bf77df06a4387f40eebc3bc4","expires":1794488393},{"id":827,"title":"2027-AL August Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 07 (2025.06.02)","media":{"kind":"youtube","videoId":"vuupTsK5Zww"},"video_url":"https://www.youtube.com/embed/vuupTsK5Zww?autoplay=0","token":"cfcd022c09ea86b58b5c4895ef7a5b34141984b209924a54da568e58ca0115fe","expires":1794488394},{"id":828,"title":"2027-AL August Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 08 (2025.06.09)","media":{"kind":"bunny","libraryId":"415489","guid":"8017ec98-4c84-4042-b764-e0d45ba187f4","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/8017ec98-4c84-4042-b764-e0d45ba187f4/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/8017ec98-4c84-4042-b764-e0d45ba187f4/?autoplay=false&preload=false","token":"7180eec7ed63444bd77eb14ccd5156cfd0e7dca63bc6963b625f15a99ff851e8","expires":1794488395},{"id":829,"title":"2027-AL August Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 09 (2025.06.16)","media":{"kind":"bunny","libraryId":"415489","guid":"e8b4eaad-3ade-487b-a0d5-21c3efec2b23","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/e8b4eaad-3ade-487b-a0d5-21c3efec2b23/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/e8b4eaad-3ade-487b-a0d5-21c3efec2b23/?autoplay=false&preload=false","token":"e3f432922ba9c75775592a8b5651043ad8a145f491da44f39df683613802fa5a","expires":1794488397},{"id":830,"title":"2027-AL August Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 10 (2025.06.23)","media":{"kind":"bunny","libraryId":"415489","guid":"6c98baef-7b78-4648-a3c8-27a1a4fc5090","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/6c98baef-7b78-4648-a3c8-27a1a4fc5090/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/6c98baef-7b78-4648-a3c8-27a1a4fc5090/?autoplay=false&preload=false","token":"8d45cb1ac6c0b577d1f32a6c55edeb6401ef5335996a1577f1e02413b9224e1c","expires":1794488400},{"id":831,"title":"2027-AL August Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 11 (2025.06.30)","media":{"kind":"bunny","libraryId":"415489","guid":"e0f4e30e-8659-4fb9-bb94-f98f088e6860","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/e0f4e30e-8659-4fb9-bb94-f98f088e6860/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/e0f4e30e-8659-4fb9-bb94-f98f088e6860/?autoplay=false&preload=false","token":"37b76fc9ea11a9b654697f715376648f98bd00497a00d61c77c6c6694fe81a9e","expires":1794488405},{"id":832,"title":"2027-AL August Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 12 (2025.07.07)","media":{"kind":"youtube","videoId":"-Gz_yhv39V4"},"video_url":"https://www.youtube.com/embed/-Gz_yhv39V4?autoplay=0","token":"16e2e99d774c8560d17831f6343c782f71df453c9052b96449ee18a917e60153","expires":1794488407},{"id":833,"title":"2027-AL August Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 13 (2025.07.14)","media":{"kind":"youtube","videoId":"a4ZK8YKI9G8"},"video_url":"https://www.youtube.com/embed/a4ZK8YKI9G8?autoplay=0","token":"f7668ed665d14af82998741abb306dd8845113c2e398fac71162cbff1527ff85","expires":1794488409},{"id":834,"title":"2027-AL August Month Lesson - New Students (After OL Results)","description":"Q and A","media":{"kind":"bunny","libraryId":"415489","guid":"ffb48638-b7f1-4f02-912d-4c5c3cdf780d","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/ffb48638-b7f1-4f02-912d-4c5c3cdf780d/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/ffb48638-b7f1-4f02-912d-4c5c3cdf780d/?autoplay=false&preload=false","token":"749d1673ebed9e0f85f98d656ab735af4771a8bcb4e98c317019ace19c1e3cd2","expires":1794488411},{"id":835,"title":"2027-AL August Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 14 (2025.07.21)","media":{"kind":"bunny","libraryId":"415489","guid":"ac17034b-f954-48a7-9522-5d0aed7d076a","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/ac17034b-f954-48a7-9522-5d0aed7d076a/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/ac17034b-f954-48a7-9522-5d0aed7d076a/?autoplay=false&preload=false","token":"960b1da654131dbed518d3b82c333a5690e320f40037334982971e2eb1852dc3","expires":1794488412},{"id":836,"title":"2027-AL August Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 15 (2025.07.28)","media":{"kind":"bunny","libraryId":"415489","guid":"956fd6b7-0c51-4c05-99c0-a7a7f5a66c65","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/956fd6b7-0c51-4c05-99c0-a7a7f5a66c65/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/956fd6b7-0c51-4c05-99c0-a7a7f5a66c65/?autoplay=false&preload=false","token":"c4e7a8bbe55a9811b64ede7e397ef595ac6b2ba4923798efbfaa4184c7f2a922","expires":1794488414},{"id":839,"title":"2027-AL August Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 16 (2025.08.04)","media":{"kind":"youtube","videoId":"P2xQEisPWJ4"},"video_url":"https://www.youtube.com/embed/P2xQEisPWJ4?autoplay=0","token":"151578cef08f5ba33279baa3d655bd64e110f7559959aa7689bb7be75a52b865","expires":1794488415},{"id":845,"title":"2027-AL August Month Lesson - New Students (After OL Results)","description":"August month - Day 02 (2025.08.11)","media":{"kind":"bunny","libraryId":"415489","guid":"1bb72e58-6bfe-4ca3-871f-59c5c2254937","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/1bb72e58-6bfe-4ca3-871f-59c5c2254937/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/1bb72e58-6bfe-4ca3-871f-59c5c2254937/?autoplay=false&preload=false","token":"c04cd04b5232ca9ba001f3f1e91ddf186684301f4b98de697b5205dfcd2d6f26","expires":1794488417},{"id":870,"title":"2027-AL August Month Lesson - New Students (After OL Results)","description":"August month - Day 03 (2025.08.18)","media":{"kind":"bunny","libraryId":"415489","guid":"309787fa-6dd7-484b-a04f-b2b15c2b6f36","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/309787fa-6dd7-484b-a04f-b2b15c2b6f36/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/309787fa-6dd7-484b-a04f-b2b15c2b6f36/?autoplay=false&preload=false","token":"ae87bd96a0629f0cb639df11279bfd96a4f43252529732ca1a33728b7fa96da7","expires":1794488419}]},{"id":117,"title":"August Month Lesson ( Lesson 02 - Evolution of the Computer )","description":"සෑම සඳුදාකම රාත්‍රී 7.00 සිට 9.00 දක්වා සජීවීව පැවැත්වේ. සජීවී විකාශය හෝ ඕනෑම වේලාවක පැමිණ නැවත විකාශය නැරඹිය හැකිය.","course_id":"2027-al","price":3000,"videos":[{"id":838,"title":"2027-AL August Month Lesson ( Lesson 02 - Evolution of the Computer )","description":"2027 AL ICT Class - Day 16 (2025.08.04)","media":{"kind":"youtube","videoId":"P2xQEisPWJ4"},"video_url":"https://www.youtube.com/embed/P2xQEisPWJ4?autoplay=0","token":"05a1d473eb2c9c37b8ad5604caa968f5a9097adce1b692b80a2515696a4ad15c","expires":1794488421},{"id":842,"title":"2027-AL August Month Lesson ( Lesson 02 - Evolution of the Computer )","description":"Python - Recursive Function","media":{"kind":"youtube","videoId":"5Fc-IngxEys"},"video_url":"https://www.youtube.com/embed/5Fc-IngxEys?autoplay=0","token":"b0dc96d17c7093d8af3dd03fec6550034f5f6ab6f75e8271057879a93937740c","expires":1794488422},{"id":846,"title":"2027-AL August Month Lesson ( Lesson 02 - Evolution of the Computer )","description":"August month -Day 02 (2025.08.11)","media":{"kind":"bunny","libraryId":"415489","guid":"1bb72e58-6bfe-4ca3-871f-59c5c2254937","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/1bb72e58-6bfe-4ca3-871f-59c5c2254937/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/1bb72e58-6bfe-4ca3-871f-59c5c2254937/?autoplay=false&preload=false","token":"2f0c7547a236d97a53507ab6698de644ccf1ce09e9ff4d81d95364f120ec8538","expires":1794488424},{"id":852,"title":"2027-AL August Month Lesson ( Lesson 02 - Evolution of the Computer )","description":"Python - File Operations (2025.08.12)","media":{"kind":"bunny","libraryId":"249724","guid":"5fd3ac2c-a8db-4759-9410-f3e0824c223b","playlistStatus":0,"playlistOk":false},"video_url":"https://iframe.mediadelivery.net/embed/249724/5fd3ac2c-a8db-4759-9410-f3e0824c223b/?autoplay=false&preload=false","token":"64cb1026349e2e3398d9313455df1d54e3fdbffccdf106c785e440abfdcf3e6c","expires":1794488426},{"id":853,"title":"2027-AL August Month Lesson ( Lesson 02 - Evolution of the Computer )","description":"Python MCQ Discussion Part 1","media":{"kind":"bunny","libraryId":"249724","guid":"fb5a7c92-84c1-4940-ad0b-7b9f658697fa","playlistStatus":0,"playlistOk":false},"video_url":"https://iframe.mediadelivery.net/embed/249724/fb5a7c92-84c1-4940-ad0b-7b9f658697fa/?autoplay=false&preload=false","token":"0ae48302aa68bdde5f5e5369481e24113bbe2842c825633429a4b9052f8a8373","expires":1794488427},{"id":871,"title":"2027-AL August Month Lesson ( Lesson 02 - Evolution of the Computer )","description":"August Month Day 03 (2025.08.18)","media":{"kind":"bunny","libraryId":"415489","guid":"309787fa-6dd7-484b-a04f-b2b15c2b6f36","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/309787fa-6dd7-484b-a04f-b2b15c2b6f36/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/309787fa-6dd7-484b-a04f-b2b15c2b6f36/?autoplay=false&preload=false","token":"ca7eb64756ddf947247438495704c91df8fe6647ad02224962129bf8153a5068","expires":1794488432}]},{"id":114,"title":"July Month Lesson - New Students (After OL Results)","description":"මෙම පාඩම සාමාන්‍ය පෙළ ප්‍රතිඵල පැමිණීමෙන් පසුව ජූලි මාසයේ පන්තියට සම්බන්ධ වන නවක සිසුන් සඳහා පමණි. පසුගිය මාස වල ලබාදුන් නිබන්ධන 3ක්  (පිටු 400) එකවර ලබාදීම සඳහා යන වියදම පියවා ගැනීමට මෙම විශේෂ ගාස්තුව අය කිරීමෙන් බලාපොරොත්තු වන අතර, ලබන මාසයේ සිට ඔවුන් සඳහාද සාමාන්‍ය පන්ති ගාස්තු අය කෙරේ. online පන්තිය සෑම සඳුදාම රාත්‍රී 7 සිට 9 දක්වා Zoom ඔස්සේ සජීවීව පැවැත්වේ. වැඩිදුර තොරතුරු දැනගැනීම සඳහා Telegram සමූහයට පිවිසෙන්න. මෙම පාඩමට ගෙවීම් කරන සියලු දෙනාට පසුගිය මගහැරුණු video සියල්ල ලබාදේ.","course_id":"2027-al","price":5000,"videos":[{"id":744,"title":"2027-AL July Month Lesson - New Students (After OL Results)","description":"2027 AL ICT නව පන්ති ආරම්භය සහ විශය සම්බන්ධ දැනුම්වත් කිරීම","media":{"kind":"youtube","videoId":"RRIeYdUl04Y"},"video_url":"https://www.youtube.com/embed/RRIeYdUl04Y?autoplay=0","token":"e6dd0c25eb3408239c09c8976f5503c2f664e1fe155b51a96a677eff9fa5dc5b","expires":1794488434},{"id":745,"title":"2027-AL July Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 01 (ඉගැන්වීම් ආරම්භය පළමු දිනය)","media":{"kind":"youtube","videoId":"ZtkTS7KllVA"},"video_url":"https://www.youtube.com/embed/ZtkTS7KllVA?autoplay=0","token":"6824f8cc44863f158e206496f84f77725398df86993ea752a073fce80022743a","expires":1794488435},{"id":747,"title":"2027-AL July Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 02 (2025.04.21)","media":{"kind":"bunny","libraryId":"249724","guid":"7b25f19a-4668-4d64-8234-c85dc07f06cf","playlistStatus":0,"playlistOk":false},"video_url":"https://iframe.mediadelivery.net/embed/249724/7b25f19a-4668-4d64-8234-c85dc07f06cf/?autoplay=false&preload=false","token":"0f6abc2e72d17f4f42a6a980bc3f8c557bc7d686da261934823374364efed04d","expires":1794488437},{"id":748,"title":"2027-AL July Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 03 (2025.04.28)","media":{"kind":"bunny","libraryId":"415489","guid":"a4c3c3a4-19ec-4b83-95d2-755159331980","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/a4c3c3a4-19ec-4b83-95d2-755159331980/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/a4c3c3a4-19ec-4b83-95d2-755159331980/?autoplay=false&preload=false","token":"b5ddf8322e764a48d4531e4170beca91872afcd1618e4d9769dd45b6c4498e83","expires":1794488440},{"id":749,"title":"2027-AL July Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 04 (2025/05/06)","media":{"kind":"youtube","videoId":"ETvOeEJ2uZ4"},"video_url":"https://www.youtube.com/embed/ETvOeEJ2uZ4?autoplay=0","token":"b5b628b3736065a10c375d0a10ae500c4bb775931231363e50cf4ce6bc9ad5a4","expires":1794488442},{"id":750,"title":"2027-AL July Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 05 Part 1 (2025/05/19)","media":{"kind":"bunny","libraryId":"415489","guid":"2fdd3778-a4ea-4b09-a921-3088f07aedca","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/2fdd3778-a4ea-4b09-a921-3088f07aedca/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/2fdd3778-a4ea-4b09-a921-3088f07aedca/?autoplay=false&preload=false","token":"835b1c0ac28528d4a715518452b493dd1b01b7fa417323bfd7242db20ba5f827","expires":1794488443},{"id":751,"title":"2027-AL July Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 05 Part 2 (2025/05/19)","media":{"kind":"bunny","libraryId":"415489","guid":"b54a48d1-5786-4570-b977-d0aaec29120f","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/b54a48d1-5786-4570-b977-d0aaec29120f/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/b54a48d1-5786-4570-b977-d0aaec29120f/?autoplay=false&preload=false","token":"e23d3fcafac3b9c4d5951d40db825080f12d9459294c53eef5fb4133b5a1930b","expires":1794488444},{"id":752,"title":"2027-AL July Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 06 (2025/05/26)","media":null,"video_url":null,"token":null,"expires":null},{"id":753,"title":"2027-AL July Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 07 (2025.06.02)","media":null,"video_url":null,"token":null,"expires":null},{"id":754,"title":"2027-AL July Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 08 (2025.06.09)","media":null,"video_url":null,"token":null,"expires":null},{"id":755,"title":"2027-AL July Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 09 (2025.06.16)","media":null,"video_url":null,"token":null,"expires":null},{"id":756,"title":"2027-AL July Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day10 (2025.06.23)","media":{"kind":"bunny","libraryId":"415489","guid":"6c98baef-7b78-4648-a3c8-27a1a4fc5090","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/6c98baef-7b78-4648-a3c8-27a1a4fc5090/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/6c98baef-7b78-4648-a3c8-27a1a4fc5090/?autoplay=false&preload=false","token":"86cda274bb33fc1d25469fb6952c63be8ff1c7a09ec82acb3a3c56ea5e950056","expires":1794488448},{"id":757,"title":"2027-AL July Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 11 (2025.06.30)","media":{"kind":"bunny","libraryId":"415489","guid":"e0f4e30e-8659-4fb9-bb94-f98f088e6860","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/e0f4e30e-8659-4fb9-bb94-f98f088e6860/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/e0f4e30e-8659-4fb9-bb94-f98f088e6860/?autoplay=false&preload=false","token":"94c8d0b8de52daac91ae5299be0c61b9a0544fd6e42b4035a7aee8bae4415e53","expires":1794488455},{"id":758,"title":"2027-AL July Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 12 (2025.07.07)","media":{"kind":"youtube","videoId":"-Gz_yhv39V4"},"video_url":"https://www.youtube.com/embed/-Gz_yhv39V4?autoplay=0","token":"7d1e523f5dd4291a7d5c78a15c164d73e1f30f661b23d00d85983cca11c1d9c9","expires":1794488457},{"id":761,"title":"2027-AL July Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 13 (2025.07.14)","media":{"kind":"youtube","videoId":"a4ZK8YKI9G8"},"video_url":"https://www.youtube.com/embed/a4ZK8YKI9G8?autoplay=0","token":"544f7ce89ff8391d1d768da0c261fa7f06312b6536919f2f6cb9750c223a4ed2","expires":1794488458},{"id":762,"title":"2027-AL July Month Lesson - New Students (After OL Results)","description":"Q and A","media":{"kind":"bunny","libraryId":"415489","guid":"ffb48638-b7f1-4f02-912d-4c5c3cdf780d","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/ffb48638-b7f1-4f02-912d-4c5c3cdf780d/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/ffb48638-b7f1-4f02-912d-4c5c3cdf780d/?autoplay=false&preload=false","token":"d6b280d8140686f2918303fa92853ee199ad1cdd1c369fad4dbdb88bf48e0a35","expires":1794488459},{"id":804,"title":"2027-AL July Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 14 (2025.07.21)","media":{"kind":"bunny","libraryId":"415489","guid":"ac17034b-f954-48a7-9522-5d0aed7d076a","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/ac17034b-f954-48a7-9522-5d0aed7d076a/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/ac17034b-f954-48a7-9522-5d0aed7d076a/?autoplay=false&preload=false","token":"d97f58152768fd5e9188b6a33374a6e5f5fff1084d1cf684b016ceb6cb070f40","expires":1794488460},{"id":811,"title":"2027-AL July Month Lesson - New Students (After OL Results)","description":"2027 AL ICT Class - Day 15 (2025.07.28)","media":{"kind":"bunny","libraryId":"415489","guid":"956fd6b7-0c51-4c05-99c0-a7a7f5a66c65","zone":"vz-0d705596-3d4","playlist":"https://vz-0d705596-3d4.b-cdn.net/956fd6b7-0c51-4c05-99c0-a7a7f5a66c65/playlist.m3u8","playlistStatus":206,"playlistOk":true},"video_url":"https://iframe.mediadelivery.net/embed/415489/956fd6b7-0c51-4c05-99c0-a7a7f5a66c65/?autoplay=false&preload=false","token":"169a2412f894b6bfcad2f9ecc3ea13759d1214dfadfeca4fb38860db14979b49","expires":1794488462}]},{"id":173,"title":"July (Final Month, One Last Time) - 2026 Revision & Speed Revision - Farewell!","description":"එදා මෙදා තුර බිහිවූ ලංකාවේ විශාලතම තොරතුරු තාක්ශණ පන්තිය නිර්මාණය කිරීමට දායක වූ, වසර ගණනක් අපව ලංකාවේ ඉහලින්ම ඔසවා තැබූ භෞතික සහ Online පන්තිවල ඔබ සියලු දෙනා වෙනුවෙන්, 2026 අවසන් මාසය සම්පූර්ණයෙන්ම නොමිලේ.","course_id":"2026-al","price":0,"videos":[{"id":1293,"title":"A/L ICT Lesson 11 | Internet of Things (IoT) & Arduino","description":"A/L ICT Lesson 11 | Internet of Things (IoT) & Arduino","media":{"kind":"youtube","videoId":"sIZ8ygESf4c"},"video_url":"https://www.youtube.com/embed/sIZ8ygESf4c?autoplay=0","token":"f59eb50ecb00afc847f591ab2ac9a7447846fc8e4a3294f7860170515d149f05","expires":1794488150},{"id":1306,"title":"Subnetting","description":"Subnetting","media":{"kind":"youtube","videoId":"BFGItNq6A5w"},"video_url":"https://www.youtube.com/embed/BFGItNq6A5w?autoplay=0","token":"c05b798135ef9d29760a354da9677cd26d5b3f33a59f14cdcc3e7ac0214091d7","expires":1794488151},{"id":1320,"title":"AL ICT Lesson 13 – New Trends & Future DIrections of ICT | නව නැඹුරුව සහ දිශානති","description":"AL ICT Lesson 13 – New Trends & Future DIrections of ICT | නව නැඹුරුව සහ දිශානති","media":{"kind":"youtube","videoId":"ZSdPr4doKdM"},"video_url":"https://www.youtube.com/embed/ZSdPr4doKdM?autoplay=0","token":"66a4ab0551cf4b982536bc70df6c81aa28a6595881936491b0707b271c86697b","expires":1794488152}]},{"id":167,"title":"All Pastpaper Discussions Upto Now","description":"මේ දක්වා සිදුකල සියලු පසුගිය විභාග ප්‍රශ්ණපත්‍ර සාකච්චා","course_id":"2026-al","price":0,"videos":[{"id":1206,"title":"Lesson 01 & 02 Pastpaper MCQ","description":"Lesson 01 & 02 Pastpaper MCQ","media":{"kind":"youtube","videoId":"smJOMATfxI4"},"video_url":"https://www.youtube.com/embed/smJOMATfxI4?autoplay=0","token":"fc3f24f39d8215e7d7be5c96117418f96898f47c82ec8b4361fa4272309caef5","expires":1794488159},{"id":1207,"title":"Lesson 03 - Number Systems Pastpaper MCQ Part 01","description":"Lesson 03 - Number Systems Pastpaper MCQ Part 01","media":{"kind":"youtube","videoId":"p6Z9FwP1ssM"},"video_url":"https://www.youtube.com/embed/p6Z9FwP1ssM?autoplay=0","token":"5249743a7a5afd33a61b29f9f66744bfc4bf7bf2feab37b7898bf19f6a0d93d0","expires":1794488160},{"id":1208,"title":"Lesson 03 - Number Systems Pastpaper Part 02","description":"Lesson 03 - Number Systems Pastpaper Part 02","media":{"kind":"youtube","videoId":"QaXDVcIxKJo"},"video_url":"https://www.youtube.com/embed/QaXDVcIxKJo?autoplay=0","token":"f5d8799361bd75a4f9ceedeb3347c085bb29c61658b9598bc1723b7851af1983","expires":1794488161},{"id":1209,"title":"Lesson 04 - Logic Gates Pastpaper MCQ","description":"Lesson 04 - Logic Gates Pastpaper MCQ","media":{"kind":"youtube","videoId":"9FVpl1oF3ec"},"video_url":"https://www.youtube.com/embed/9FVpl1oF3ec?autoplay=0","token":"c174be76d80c89e1bafd2d0be353a59a56925084459044f8dd1f23d58403727e","expires":1794488163},{"id":1210,"title":"Lesson 05 - Operating System Pastpaper MCQ","description":"Lesson 05 - Operating System Pastpaper MCQ","media":{"kind":"youtube","videoId":"89dAIzyvgXM"},"video_url":"https://www.youtube.com/embed/89dAIzyvgXM?autoplay=0","token":"9b62140e5d7f0d55ddaee7fbaa08250c5d2124d62144a7c5e4e7105cdb4e2177","expires":1794488164},{"id":1212,"title":"Lesson 05 - Operating System Pastpaper SE & Essay Part 01","description":"Lesson 05 - Operating System Pastpaper SE & Essay Part 01","media":{"kind":"youtube","videoId":"o3WThf6_XK0"},"video_url":"https://www.youtube.com/embed/o3WThf6_XK0?autoplay=0","token":"326567376f5b007551f203bf29ae4f773f44825c26905757fb24108d006251f0","expires":1794488170},{"id":1213,"title":"Lesson 07 - System Development Pastpaper MCQ","description":"Lesson 07 - System Development Pastpaper MCQ","media":{"kind":"youtube","videoId":"USHR3OBN1uA"},"video_url":"https://www.youtube.com/embed/USHR3OBN1uA?autoplay=0","token":"4c5c2f6df172d44d6d1d2f71dff8fa00fc3931c7fd37894e8a250efb79cc94ab","expires":1794488172},{"id":1214,"title":"Lesson 08 - Database Pastpaper MCQ Part 01","description":"Lesson 08 - Database Pastpaper MCQ Part 01","media":{"kind":"youtube","videoId":"WK7vEYW4Uj4"},"video_url":"https://www.youtube.com/embed/WK7vEYW4Uj4?autoplay=0","token":"2d84a86194a4bb301189ec13db7b04b0da26541a6c5e00ddc9a1071b7d400a1e","expires":1794488173},{"id":1215,"title":"Lesson 08 - Database Pastpaper MCQ Part 02","description":"Lesson 08 - Database Pastpaper MCQ Part 02","media":{"kind":"youtube","videoId":"7VpAqJ_DmYk"},"video_url":"https://www.youtube.com/embed/7VpAqJ_DmYk?autoplay=0","token":"77e395b5b1174be483c15c6fe4e96718f6f40cf51fee056b4fdd1f6f14126f71","expires":1794488175},{"id":1216,"title":"Lesson 09 - Python Programming Pastpaper MCQ","description":"Lesson 09 - Python Programming Pastpaper MCQ","media":{"kind":"youtube","videoId":"zDgZfn4UKgM"},"video_url":"https://www.youtube.com/embed/zDgZfn4UKgM?autoplay=0","token":"be61e204f2d58ed5c8547436b8eef2f68fd0d47a0c3980d3f08b1020cb541eef","expires":1794488178},{"id":1217,"title":"Lesson 10 - HTML CSS PHP Pastpaper MCQ","description":"Lesson 10 - HTML CSS PHP Pastpaper MCQ","media":{"kind":"youtube","videoId":"hTKqbvml-II"},"video_url":"https://www.youtube.com/embed/hTKqbvml-II?autoplay=0","token":"d64eaae13c0e595a527cc27f7276baee6a2d04543c89438e918d59803f29aa18","expires":1794488188},{"id":1218,"title":"Lesson 10 - HTML CSS PHP Pastpaper SE & Essay Part 01","description":"Lesson 10 - HTML CSS PHP Pastpaper SE & Essay Part 01","media":{"kind":"youtube","videoId":"LwUYAQFiY_4"},"video_url":"https://www.youtube.com/embed/LwUYAQFiY_4?autoplay=0","token":"15acceca300de3189a6bc558ae31d3f052edbd20f1dd30505c984c2d84d11ac5","expires":1794488189}]},{"id":178,"title":"LESSON 13 - NEW TRENDS AND FUTURE DIRECTIONS OF ICT (2026 LATEST VIDEOS)","description":"New Trends & Future DIrections of ICT | නව නැඹුරුව සහ දිශානති","course_id":"al-videos","price":0,"videos":[{"id":1324,"title":"AL ICT Lesson 13","description":"New Trends & Future DIrections of ICT | නව නැඹුරුව සහ දිශානති","media":{"kind":"youtube","videoId":"ZSdPr4doKdM"},"video_url":"https://www.youtube.com/embed/ZSdPr4doKdM?autoplay=0","token":"d2b49fbb3c53721b07e43a892f3bac0dc88a07faa7bd0057e0acad7e1dca2c6e","expires":1794488148}]},{"id":128,"title":"LESSON 09- PYTHON (2026 LATEST VIDEOS)","description":"Python ක්‍රමලේඛණය පාඩමේ සියලුම වීඩියෝ මෙමගින් ලබාගත හැකිය. විභාගයට ලකුණු 20 කි. නිබන්ධන වෙනම ගෙන්වාගත යුතුය.","course_id":"al-videos","price":8000,"videos":[{"id":897,"title":"LESSON 09 - PYTHON (2026 LATEST VIDEOS)","description":"Python Day 01","media":{"kind":"youtube","videoId":"avUfBN7HZo4"},"video_url":"https://www.youtube.com/embed/avUfBN7HZo4?autoplay=0","token":"e3d0843fc755b62e89196859a86fab24d9421b78f963dcaedec3f00b40cf01eb","expires":1794488288},{"id":898,"title":"LESSON 09 - PYTHON (2026 LATEST VIDEOS)","description":"Python Day 02","media":{"kind":"bunny","libraryId":"249724","guid":"8c6dacb3-111d-4354-ad9b-25f0e5e10b41","playlistStatus":0,"playlistOk":false},"video_url":"https://iframe.mediadelivery.net/embed/249724/8c6dacb3-111d-4354-ad9b-25f0e5e10b41/?autoplay=false&preload=false","token":"5d24c7f65807fb32a6187f19a028a0a8d6b175315c88ddbe29c061282b039385","expires":1794488289},{"id":899,"title":"LESSON 09 - PYTHON (2026 LATEST VIDEOS)","description":"Python Day 03","media":{"kind":"bunny","libraryId":"249724","guid":"d6799343-f54e-49d5-ac64-008f47bf9109","playlistStatus":0,"playlistOk":false},"video_url":"https://iframe.mediadelivery.net/embed/249724/d6799343-f54e-49d5-ac64-008f47bf9109/?autoplay=false&preload=false","token":"d61bffb9ae657597dc55f7120c062828888b21c4198e6fad8a43fba9ff372a2d","expires":1794488296},{"id":900,"title":"LESSON 09 - PYTHON (2026 LATEST VIDEOS)","description":"Python Day 04","media":{"kind":"youtube","videoId":"DTjpqIh-FRQ"},"video_url":"https://www.youtube.com/embed/DTjpqIh-FRQ?autoplay=0","token":"f8a15d7a31e7635f10747dcca93be4e032ae4367bf4fab77e16c5f9950f848b9","expires":1794488297},{"id":901,"title":"LESSON 09 - PYTHON (2026 LATEST VIDEOS)","description":"Python Day 05","media":{"kind":"bunny","libraryId":"249724","guid":"3f4a3272-9154-4ee0-ad04-cadc1b9e97dd","playlistStatus":0,"playlistOk":false},"video_url":"https://iframe.mediadelivery.net/embed/249724/3f4a3272-9154-4ee0-ad04-cadc1b9e97dd/?autoplay=false&preload=false","token":"56a022038a85e66a7e4d6ccf723861831c8b2d761f0a14eca572e04006663faa","expires":1794488302},{"id":902,"title":"LESSON 09 - PYTHON (2026 LATEST VIDEOS)","description":"Python Day 06","media":{"kind":"bunny","libraryId":"249724","guid":"10121404-6657-4ed4-b181-9589284826de","playlistStatus":0,"playlistOk":false},"video_url":"https://iframe.mediadelivery.net/embed/249724/10121404-6657-4ed4-b181-9589284826de/?autoplay=false&preload=false","token":"35fe5cc1cdae51ae96190bd00ff700d0490962913e85495b719dd165f915dc26","expires":1794488303},{"id":903,"title":"LESSON 09 - PYTHON (2026 LATEST VIDEOS)","description":"Python Day 07","media":{"kind":"bunny","libraryId":"249724","guid":"d6897b8b-33c3-4795-af9e-073ad5c4d532","playlistStatus":0,"playlistOk":false},"video_url":"https://iframe.mediadelivery.net/embed/249724/d6897b8b-33c3-4795-af9e-073ad5c4d532/?autoplay=false&preload=false","token":"f2384b7b8c6b1f4ff55d68a5c8f13b8de9ff6b4f8db028761cfd09b80ab07f4c","expires":1794488309},{"id":904,"title":"LESSON 09 - PYTHON (2026 LATEST VIDEOS)","description":"Python Day 08","media":{"kind":"bunny","libraryId":"249724","guid":"f97db466-6dbe-4f73-885e-d4dfa971e6af","playlistStatus":0,"playlistOk":false},"video_url":"https://iframe.mediadelivery.net/embed/249724/f97db466-6dbe-4f73-885e-d4dfa971e6af/?autoplay=false&preload=false","token":"f16c152f8e48a322d4a9ff28a174c90b780da8a2922ba7b056411e0be6da3b8e","expires":1794488312},{"id":905,"title":"LESSON 09 - PYTHON (2026 LATEST VIDEOS)","description":"Python Day 09","media":{"kind":"bunny","libraryId":"249724","guid":"e1e3d73b-870f-440f-b64c-5c1a4713ec03","playlistStatus":0,"playlistOk":false},"video_url":"https://iframe.mediadelivery.net/embed/249724/e1e3d73b-870f-440f-b64c-5c1a4713ec03/?autoplay=false&preload=false","token":"86026a415a4440cc024338339c39ff40b70f8c79d988d88835e7dc6c6e50f1d3","expires":1794488318},{"id":906,"title":"LESSON 09 - PYTHON (2026 LATEST VIDEOS)","description":"Python Day 10","media":{"kind":"bunny","libraryId":"249724","guid":"02fe37ea-2848-4213-b790-92ed7266aaeb","playlistStatus":0,"playlistOk":false},"video_url":"https://iframe.mediadelivery.net/embed/249724/02fe37ea-2848-4213-b790-92ed7266aaeb/?autoplay=false&preload=false","token":"f8f3d678c911d6ce1f27b390d1370ac5a4dd74ae2495601b92f21670341c1f79","expires":1794488319},{"id":907,"title":"LESSON 09 - PYTHON (2026 LATEST VIDEOS)","description":"Python Day 11","media":{"kind":"bunny","libraryId":"249724","guid":"49834edf-23dd-4b10-95c8-9a74d362f342","playlistStatus":0,"playlistOk":false},"video_url":"https://iframe.mediadelivery.net/embed/249724/49834edf-23dd-4b10-95c8-9a74d362f342/?autoplay=false&preload=false","token":"0f05d7633c0857ef3bb59eb8379a0849991794e6fd137f319f43a077bd3631b1","expires":1794488320},{"id":908,"title":"LESSON 09 - PYTHON (2026 LATEST VIDEOS)","description":"Python Day 12 -  Recursive functions","media":{"kind":"youtube","videoId":"5Fc-IngxEys"},"video_url":"https://www.youtube.com/embed/5Fc-IngxEys?autoplay=0","token":"d052f2840b481e2361617e681fd004d01fe15492b78614fa3a27a21dabc309cc","expires":1794488322},{"id":909,"title":"LESSON 09 - PYTHON (2026 LATEST VIDEOS)","description":"Python Day 13 - File Operation  I","media":{"kind":"bunny","libraryId":"249724","guid":"5fd3ac2c-a8db-4759-9410-f3e0824c223b","playlistStatus":0,"playlistOk":false},"video_url":"https://iframe.mediadelivery.net/embed/249724/5fd3ac2c-a8db-4759-9410-f3e0824c223b/?autoplay=false&preload=false","token":"a2e9ee253a47978f5b39dcb73d425db8de4613b836584e5febb45fa9e641288a","expires":1794488323},{"id":910,"title":"LESSON 09 - PYTHON (2026 LATEST VIDEOS)","description":"Python Day 14 - File Operation II","media":{"kind":"bunny","libraryId":"249724","guid":"e7ccd59c-6216-41ea-814e-0511a0a321ed","playlistStatus":0,"playlistOk":false},"video_url":"https://iframe.mediadelivery.net/embed/249724/e7ccd59c-6216-41ea-814e-0511a0a321ed/?autoplay=false&preload=false","token":"cd2fa4ecf92386e74cba86a8269a79c1672fa102263a888dbdd6764447463102","expires":1794488324},{"id":911,"title":"LESSON 09 - PYTHON (2026 LATEST VIDEOS)","description":"Python Day 15 - Sorting algorithms - Bubble Sort","media":{"kind":"bunny","libraryId":"249724","guid":"ecdbb534-634a-4539-b8f5-1c4e85a306fc","playlistStatus":0,"playlistOk":false},"video_url":"https://iframe.mediadelivery.net/embed/249724/ecdbb534-634a-4539-b8f5-1c4e85a306fc/?autoplay=false&preload=false","token":"30af6243df08dfed487749047a55de65afc5a7db4c32c07d16910316282512ae","expires":1794488325},{"id":912,"title":"LESSON 09 - PYTHON (2026 LATEST VIDEOS)","description":"Python Day 16 - Flow Charts","media":{"kind":"youtube","videoId":"HQEkkYKUc2c"},"video_url":"https://www.youtube.com/embed/HQEkkYKUc2c??autoplay=0","token":"33a72bcc6b657ee56a3b5e888399148fe975c306f2840b764a20aed27cfc1b94","expires":1794488326},{"id":945,"title":"LESSON 09 - PYTHON (2026 LATEST VIDEOS)","description":"Python Day 15 - Sorting algorithms - Bubble Sort","media":{"kind":"youtube","videoId":"-S0YXaGdVpg"},"video_url":"https://www.youtube.com/embed/-S0YXaGdVpg?autoplay=0","token":"27f41a75584dacbf687c444fae2b9cbff46e9004bf64fc44039baa91a0ea117a","expires":1794488327},{"id":947,"title":"LESSON 09 - PYTHON (2026 LATEST VIDEOS)","description":"Python Dictionaries කොටස - AL ICT","media":{"kind":"youtube","videoId":"w8lnLrWltKQ"},"video_url":"https://www.youtube.com/embed/w8lnLrWltKQ?autoplay=0","token":"36f8e542d700c35aa91cc29dea5fef9b371b34ba80b794d38cd5c78c6e2d8304","expires":1794488334},{"id":948,"title":"AL-VIDEOS Python (LESSON 09)","description":"Database Connection","media":{"kind":"bunny","libraryId":"131497","guid":"4b56e661-542e-43c8-b760-f0a7705fc68e","playlistStatus":0,"playlistOk":false},"video_url":"https://iframe.mediadelivery.net/embed/131497/4b56e661-542e-43c8-b760-f0a7705fc68e/?autoplay=false&preload=false","token":"ec449896db2651c6788e95a270bf5f47f3f139ae84531086035a721ca7915ce3","expires":1794488335},{"id":1070,"title":"Python MySQL Database Connection","description":"Python MySQL Database Connection","media":{"kind":"youtube","videoId":"12QX846RHlw"},"video_url":"https://www.youtube.com/embed/12QX846RHlw?autoplay=0","token":"f3c54bd0822f4ff6d0164fc90e2961a53611215ee93f9cd11d8fd182c58d8265","expires":1794488336},{"id":1090,"title":"LESSON 09- PYTHON (2026 LATEST VIDEOS)","description":"Python - Pseudocodes","media":{"kind":"bunny","libraryId":"249724","guid":"00c24b4a-0be5-41c6-91f5-5fb447297b90","playlistStatus":0,"playlistOk":false},"video_url":"https://iframe.mediadelivery.net/embed/249724/00c24b4a-0be5-41c6-91f5-5fb447297b90?preload=false","token":"fe38d069d326c5c1899954207361f42c5be1d5506b196e406afd4974d435883b","expires":1794488337},{"id":1091,"title":"LESSON 09- PYTHON (2026 LATEST VIDEOS)","description":"Python - Language Translators","media":{"kind":"bunny","libraryId":"249724","guid":"830bb059-0aae-44ef-b0ef-ac15d869e24c","playlistStatus":0,"playlistOk":false},"video_url":"https://iframe.mediadelivery.net/embed/249724/830bb059-0aae-44ef-b0ef-ac15d869e24c?preload=false","token":"443da3b87836ab4550212c7c80b9f74c8ba851a992c738ba05ab09878f6dc7e3","expires":1794488339}]},{"id":121,"title":"E-Commerce (2025 AL Videos)","description":"විද්‍යුත් වානිජ්‍ය පාඩමේ සියලු වීඩියෝ මෙමගින් ලබාගත හැකිය. විභාගයට ලකුණු 4කි. නිබන්ධන වෙනම ගෙන්වාගත යුතුය.","course_id":"al-videos","price":0,"videos":[{"id":855,"title":"AL-VIDEOS E-Commerce (2025 AL Videos)","description":"full lesson","media":{"kind":"youtube","videoId":"_yWA7PbpmVg"},"video_url":"https://www.youtube.com/embed/_yWA7PbpmVg?autoplay=0","token":"5e7acc89ff55f85db808cb04fc94917810dc544f9c006ff923fe88e808f5b7e4","expires":1794488364}]},{"id":119,"title":"Operating Systems - Memory Management (Paging)","description":"මතක කළමණාකරණය - පිටුකරණය\nMemory Management (Paging)","course_id":"al-videos","price":0,"videos":[{"id":813,"title":"AL-VIDEOS Operating Systems - Memory Management (Paging)","description":"Day 01","media":{"kind":"youtube","videoId":"tn628DX5gXY"},"video_url":"https://www.youtube.com/embed/tn628DX5gXY?autoplay=0","token":"4df4e7deacec97d35f5d9b3d3a9bbae6949ddd594182ae4daca3610ca6e7369d","expires":1794488366},{"id":814,"title":"AL-VIDEOS Operating Systems - Memory Management (Paging)","description":"Day 02","media":{"kind":"youtube","videoId":"fVPQNKxANEQ"},"video_url":"https://www.youtube.com/embed/fVPQNKxANEQ?autoplay=0","token":"9f0a150580a566241821af577af913c67c1e05c8fd7313bf99af8d8a1673b9cd","expires":1794488367}]},{"id":95,"title":"ගනන්","description":"විවිධ පාඩම් වලට අදාල විසඳූ ගණිත ගැටලු","course_id":"al-videos","price":0,"videos":[{"id":608,"title":"AL-VIDEOS ගනන්","description":"Simplifying Boolean algebraic expressions බූලීය වීජ ගණිත සමීකරණ සුළුකිරීම් (9.30Hours video)","media":{"kind":"youtube","videoId":"bNUJqlvHuHo"},"video_url":"https://www.youtube.com/embed/bNUJqlvHuHo?autoplay=0","token":"f65baf8be198f66b7b691b918223e6d666e8acd2e703aa2444355265be4f8d63","expires":1794488464},{"id":609,"title":"AL-VIDEOS ගනන්","description":"AL ICT - Logic Gates | අසම්මත ප්‍රකාශ සම්මත ප්‍රකාශ බවට හැරවීම | Non Standard Boolean into Standard (04.03.2025) Part 1","media":{"kind":"youtube","videoId":"GCHS0csU-iI"},"video_url":"https://www.youtube.com/embed/GCHS0csU-iI?autoplay=0","token":"89ecc8854e3e7f14f3241227a0d0e7edaaae0902d85a569828654eff2d2e3445","expires":1794488465}]},{"id":91,"title":"Pastpaper Discussions 2011-2024","description":"2011 සිට 2024 දක්වා උසස් පෙළ විභාගයට ලැබුණු ප්‍රශ්ණපත්‍ර වල ප්‍රශ්ණ මෙහිදී සාකච්ඡා කරමින් පවතී. විභාගයට පෙර මේවා සියල්ල නරඹන්න.","course_id":"al-videos","price":0,"videos":[{"id":584,"title":"AL ICT - Database - SQL | 2011-2024 Pastpaper MCQ Discussion","description":"AL ICT - Database - SQL | 2011-2024 Pastpaper MCQ Discussion","media":{"kind":"youtube","videoId":"7VpAqJ_DmYk"},"video_url":"https://www.youtube.com/embed/7VpAqJ_DmYk?autoplay=0","token":"5ff963624d0477a3cf6c2b9c5ef3d291718075aa2fe36a62d17e411e611d87f5","expires":1794488479},{"id":585,"title":"AL ICT - Database | 2011-2024 Pastpaper MCQ Discussion","description":"AL ICT - Database | 2011-2024 Pastpaper MCQ Discussion","media":{"kind":"youtube","videoId":"WK7vEYW4Uj4"},"video_url":"https://www.youtube.com/embed/WK7vEYW4Uj4?autoplay=0","token":"a163fac600fcab5c6a7282d5f97ba6c5a3629127539b53ab2a8f9d8c46a83b42","expires":1794488480},{"id":936,"title":"Number Systems Pastpaper Questions 2011-2024","description":"Number Systems Pastpaper Questions 2011-2024","media":{"kind":"youtube","videoId":"p6Z9FwP1ssM"},"video_url":"https://www.youtube.com/embed/p6Z9FwP1ssM?autoplay=0","token":"15c0c13deb405061c11a867cb5a158827edb8f73428f6e3b99b61e8dd483bf7a","expires":1794488482},{"id":937,"title":"AL ICT - 1s Complement, 2s Complement | 2011-2024 Pastpaper MCQ Discussion","description":"AL ICT - 1s Complement, 2s Complement | 2011-2024 Pastpaper MCQ Discussion","media":{"kind":"youtube","videoId":"QaXDVcIxKJo"},"video_url":"https://www.youtube.com/embed/QaXDVcIxKJo?autoplay=0","token":"473dabbf4f1ce8d333d5b635a03573df67b1224c24997cc48ca89ba45b4c2555","expires":1794488483},{"id":938,"title":"AL ICT - Lesson 1 & 2 | 2011-2024 Pastpaper MCQ Discussion","description":"AL ICT - Lesson 1 & 2 | 2011-2024 Pastpaper MCQ Discussion","media":{"kind":"youtube","videoId":"smJOMATfxI4"},"video_url":"https://www.youtube.com/embed/smJOMATfxI4?autoplay=0","token":"41783838d13bf679ea1e7210a6058d74224588000011d95b9858c9fd5d3ebbf6","expires":1794488484},{"id":939,"title":"AL ICT - Logic Gates | 2011-2023 Pastpaper MCQ Discussion","description":"AL ICT - Logic Gates | 2011-2023 Pastpaper MCQ Discussion","media":{"kind":"youtube","videoId":"9FVpl1oF3ec"},"video_url":"https://www.youtube.com/embed/9FVpl1oF3ec?autoplay=0","token":"0446505568ced398985f92e603c33bc1a7383d617654096afbb7e5b87e67e5c5","expires":1794488485},{"id":1275,"title":"Lesson 05 - Operating System Pastpaper MCQ","description":"Lesson 05 - Operating System Pastpaper MCQ","media":{"kind":"youtube","videoId":"89dAIzyvgXM"},"video_url":"https://www.youtube.com/embed/89dAIzyvgXM?autoplay=0","token":"41afc3fc9f851da5c1f1d5d1585109facd69c8faed7279579822fc56ed052b28","expires":1794488486},{"id":1276,"title":"Lesson 05 - Operating System Pastpaper SE & Essay Part 01","description":"Lesson 05 - Operating System Pastpaper SE & Essay Part 01","media":{"kind":"youtube","videoId":"o3WThf6_XK0"},"video_url":"https://www.youtube.com/embed/o3WThf6_XK0?autoplay=0","token":"c10f9d2fc547901dcdadfa2f0e1fb452810f20621d91ad249d3294256275a7a2","expires":1794488487},{"id":1277,"title":"Lesson 07 - System Development Pastpaper MCQ","description":"Lesson 07 - System Development Pastpaper MCQ","media":{"kind":"youtube","videoId":"USHR3OBN1uA"},"video_url":"https://www.youtube.com/embed/USHR3OBN1uA?autoplay=0","token":"1f1144c656aecbc7e03993cb25ddba5cad25be20a51cd3bb6b4eb4c19a467513","expires":1794488489},{"id":1278,"title":"Lesson 09 - Python Programming Pastpaper MCQ","description":"Lesson 09 - Python Programming Pastpaper MCQ","media":{"kind":"youtube","videoId":"zDgZfn4UKgM"},"video_url":"https://www.youtube.com/embed/zDgZfn4UKgM?autoplay=0","token":"57c19ee9487a0ab21ef9775cfc323602e0058728123c1fce4e962d66b0a34100","expires":1794488490},{"id":1279,"title":"Lesson 10 - HTML CSS PHP Pastpaper MCQ","description":"Lesson 10 - HTML CSS PHP Pastpaper MCQ","media":{"kind":"youtube","videoId":"hTKqbvml-II"},"video_url":"https://www.youtube.com/embed/hTKqbvml-II?autoplay=0","token":null,"expires":null},{"id":1280,"title":"Lesson 10 - HTML CSS PHP Pastpaper SE & Essay Part 01","description":"Lesson 10 - HTML CSS PHP Pastpaper SE & Essay Part 01","media":null,"video_url":null,"token":null,"expires":null}]},{"id":90,"title":"High Speed Lesson Revisions","description":"","course_id":"al-videos","price":0,"videos":[]},{"id":22,"title":"PAPER ANALYSIS - ප්‍රශ්ණපත්‍රය විශ්ලේශණය","description":"","course_id":"al-videos","price":0,"videos":[]},{"id":92,"title":"Programming with Pascal","description":"Programming with Pascal","course_id":"ol-videos","price":0,"videos":[{"id":587,"title":"OL-VIDEOS Programming with Pascal","description":"Day 01","media":{"kind":"youtube","videoId":"VVQvy07f4FE"},"video_url":"https://www.youtube.com/embed/VVQvy07f4FE?autoplay=0","token":"732bec06b8785a4f9a43afb759cac9f43e47bbdaa10928b3d4b614babb3d196f","expires":1794488467},{"id":588,"title":"OL-VIDEOS Programming with Pascal","description":"Day 02","media":{"kind":"youtube","videoId":"1Yxd4zvwR3c"},"video_url":"https://www.youtube.com/embed/1Yxd4zvwR3c?autoplay=0","token":"947b0ffda682ab3b876f9e04279a90b8f0b3f56fbaac22a56310646d7bb5cd98","expires":1794488468},{"id":589,"title":"OL-VIDEOS Programming with Pascal","description":"Day 03","media":{"kind":"youtube","videoId":"OVFxxJbrTOI"},"video_url":"https://www.youtube.com/embed/OVFxxJbrTOI?autoplay=0","token":"02cb4e1973499094cacf4bf31dc4a54fe50a96cc6d1fb8ecd8d7f4c888435299","expires":1794488469},{"id":590,"title":"OL-VIDEOS Programming with Pascal","description":"Day 04","media":{"kind":"youtube","videoId":"3GyejPAUGWo"},"video_url":"https://www.youtube.com/embed/3GyejPAUGWo?autoplay=0","token":"25c4cfe1c219b8dbb268808b7c78975817c1646b0317945b2dea441fa8bb5665","expires":1794488470},{"id":591,"title":"OL-VIDEOS Programming with Pascal","description":"Day 05","media":{"kind":"youtube","videoId":"pecGTEtvZXw"},"video_url":"https://www.youtube.com/embed/pecGTEtvZXw?autoplay=0","token":"11403ea3c2fec4fa51b85dbaa1c80769fc850736ac354d33f9801b4cc668d7ff","expires":1794488472},{"id":592,"title":"OL-VIDEOS Programming with Pascal","description":"Flowcharts","media":{"kind":"youtube","videoId":"Z1fhV82RwWU"},"video_url":"https://www.youtube.com/embed/Z1fhV82RwWU?autoplay=0","token":"8fea8c2241b6421491a88488057b43b962927960defa42d630fdba38d0994a47","expires":1794488473},{"id":596,"title":"OL-VIDEOS Programming with Pascal","description":"Day 07","media":{"kind":"youtube","videoId":"mB09nSH0e7c"},"video_url":"https://www.youtube.com/embed/mB09nSH0e7c?autoplay=0","token":"2e5fe90ee3c8a4aae059a35fd7b97e3255d5616cc5a4c5dcce12f1cbdcc3ce32","expires":1794488474},{"id":597,"title":"OL-VIDEOS Programming with Pascal","description":"Day 08","media":{"kind":"youtube","videoId":"uoRIaPultSY"},"video_url":"https://www.youtube.com/embed/uoRIaPultSY?autoplay=0","token":"37937bcee3b662c26e0ce9e44634ea157fcf4182043cb40096c6c1a3c9669ad3","expires":1794488475},{"id":598,"title":"OL-VIDEOS Programming with Pascal","description":"Day 09","media":{"kind":"youtube","videoId":"vM7peO-dg3s"},"video_url":"https://www.youtube.com/embed/vM7peO-dg3s?autoplay=0","token":"ba75555e7c739e59607063dc71078ebc3b3372646f2b6626e2a7f1d3088c64df","expires":1794488476}]},{"id":87,"title":"Database (Grade 10-Lesson 09)","description":"","course_id":"ol-videos","price":0,"videos":[]},{"id":86,"title":"Presentation (Grade 10-Lesson 08)","description":"","course_id":"ol-videos","price":0,"videos":[]},{"id":83,"title":"Internet (Grade 11-Lesson3)","description":"","course_id":"ol-videos","price":0,"videos":[]},{"id":71,"title":"Spreadsheets (Grade 10 - Lesson 7)","description":"","course_id":"ol-videos","price":0,"videos":[]},{"id":70,"title":"HTML (Grade 11 - Lesson 5)","description":"","course_id":"ol-videos","price":0,"videos":[]},{"id":61,"title":"PAPER ANALYSIS - ප්‍රශ්ණපත්‍රය විශ්ලේශණය","description":"","course_id":"ol-videos","price":0,"videos":[]},{"id":56,"title":"Word Processing (Grade 10-Lesson 6)","description":"","course_id":"ol-videos","price":0,"videos":[]},{"id":37,"title":"Number Systems (Grade 10-Lesson 3)","description":"","course_id":"ol-videos","price":0,"videos":[]},{"id":35,"title":"Logic Gates (Grade 10-Lesson 4)","description":"","course_id":"ol-videos","price":0,"videos":[]},{"id":33,"title":"Final Seminars","description":"","course_id":"ol-videos","price":0,"videos":[]},{"id":31,"title":"ICT and Society (Grade 11-Lesson6)","description":"","course_id":"ol-videos","price":0,"videos":[]},{"id":29,"title":"System Development (Grade 11-Lesson 2)","description":"","course_id":"ol-videos","price":0,"videos":[]},{"id":28,"title":"Operating Systems (Grade 10-Lesson 5)","description":"","course_id":"ol-videos","price":0,"videos":[]},{"id":34,"title":"GIT Seminars","description":"","course_id":"git","price":0,"videos":[]},{"id":188,"title":"Introduction","description":"AL ICT Introduction","course_id":"al-2029","price":0,"videos":[{"id":1380,"title":"Government University Entrance Guide","description":"Complete UGC Handbook Explained (All A/L Streams Sri Lanka)","media":{"kind":"youtube","videoId":"NRIwxDJc47o"},"video_url":"https://www.youtube.com/embed/NRIwxDJc47o?autoplay=0","token":"df893f8a615b33dc383ad1a235dc0ea0","expires":1794477240},{"id":1381,"title":"Z Score Explained for A/L Students","description":"How Sri Lanka University Entrance REALLY Works","media":{"kind":"youtube","videoId":"bHjHnzBDMOg"},"video_url":"https://www.youtube.com/embed/bHjHnzBDMOg?autoplay=0","token":"72cf002027f0c68cdb3593ddb58a1636","expires":1794476000},{"id":1382,"title":"IT Degrees Explained","description":"Software, AI CyberSecurity, DataScience, ComputerScience & Automation Risk","media":{"kind":"youtube","videoId":"BYKAt8xjXyo"},"video_url":"https://www.youtube.com/embed/BYKAt8xjXyo?autoplay=0","token":"4f7ac92f8d92a8f2498c6e32900fc108","expires":1794476629},{"id":1383,"title":"2025 AL ප්‍රතිඵල","description":"A B 1300 ක් එක්ක ලංකාවේ පළවෙනියො දෙන්නෙක්","media":{"kind":"youtube","videoId":"8JTkZgfrak0"},"video_url":"https://www.youtube.com/embed/8JTkZgfrak0?autoplay=0","token":"d477805edc4f3c7342b8b388a9113721","expires":1794474153}]}]};
  const LESSONS = (DATA && DATA.lessons) || [];
  const COURSE_LABELS = (DATA && DATA.courseLabels) || {};
  const LESSON_MAP = new Map(LESSONS.map(l => [Number(l.id), l]));
  const STORE_KEY = 'ict_unlock_ids_v1';
  const SCAN_KEY = 'ict_unlock_scan_v1';

  function loadIds() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) return new Set(arr.map(Number));
      }
    } catch (e) { /* ignore */ }
    return new Set(LESSONS.map(l => Number(l.id)));
  }

  let accessIds = loadIds();

  function saveIds() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify([...accessIds])); } catch (e) { /* ignore */ }
  }

  function loadScan() {
    try {
      const raw = localStorage.getItem(SCAN_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      for (const l of arr) {
        const id = Number(l.id);
        if (!id) continue;
        const existing = LESSON_MAP.get(id);
        if (existing) {
          if ((!existing.videos || !existing.videos.length) && l.videos && l.videos.length) existing.videos = l.videos;
        } else {
          LESSONS.push(l);
          LESSON_MAP.set(id, l);
        }
      }
    } catch (e) { /* ignore */ }
  }
  loadScan();

  const origFetch = window.fetch.bind(window);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function urlOf(input) {
    try {
      const raw = typeof input === 'string' ? input : (input && input.url) || String(input);
      return new URL(raw, location.origin);
    } catch (e) { return null; }
  }

  function isApi(u) {
    return u && /(^|\.)ictfromabc\.com$/i.test(u.hostname) && /^\/api\//.test(u.pathname);
  }

  function synth(l) {
    return {
      id: l.id,
      title: l.title,
      description: l.description || '',
      course_id: l.course_id,
      price: l.price == null ? 0 : l.price,
      created_at: l.created_at || null,
      purchase_status: 'ALLOWED',
      has_tutes: false,
      zoom: null
    };
  }

  function markAllowed(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const id = Number(obj.id);
    if (accessIds.has(id)) return Object.assign({}, obj, { purchase_status: 'ALLOWED' });
    return obj;
  }

  function mergeArray(arr) {
    let changed = false;
    const out = arr.map(item => {
      const next = markAllowed(item);
      if (next !== item) changed = true;
      return next;
    });
    const have = new Set(out.map(x => Number(x.id)));
    for (const id of accessIds) {
      if (have.has(id)) continue;
      const l = LESSON_MAP.get(id);
      if (!l) continue;
      out.push(synth(l));
      have.add(id);
      changed = true;
    }
    return { out, changed };
  }

  function rewriteJson(json) {
    if (Array.isArray(json)) {
      const { out, changed } = mergeArray(json);
      return changed ? out : json;
    }
    if (json && Array.isArray(json.lessons)) {
      const { out, changed } = mergeArray(json.lessons);
      return changed ? Object.assign({}, json, { lessons: out }) : json;
    }
    return json;
  }

  const COURSE_SKIP = new Set(['grades', 'ol-lessons']);

  function shouldRewrite(pathname) {
    if (pathname === '/api/lessons/allowed') return 'allowed';
    if (pathname === '/api/lessons') return 'lessons';
    const m = pathname.match(/^\/api\/courses\/([^/]+)$/);
    if (m && !COURSE_SKIP.has(m[1])) return 'course';
    return null;
  }

  window.fetch = async function (input, init) {
    const u = urlOf(input);
    const mode = u && isApi(u) ? shouldRewrite(u.pathname) : null;
    const res = await origFetch(input, init);
    if (!mode || !res || !res.ok) return res;
    try {
      const data = await res.clone().json();
      const next = rewriteJson(data);
      if (next === data) return res;
      const headers = new Headers(res.headers);
      headers.delete('content-length');
      headers.delete('content-encoding');
      headers.set('content-type', 'application/json; charset=utf-8');
      return new Response(JSON.stringify(next), { status: res.status, statusText: res.statusText, headers });
    } catch (e) {
      return res;
    }
  };

  // ---------------------------------------------------------------------------
  // Media helpers
  // ---------------------------------------------------------------------------

  const ZONES = { '415489': 'vz-0d705596-3d4', '619330': 'vz-842e9805-ddc' };

  function classify(url) {
    if (!url) return { kind: 'none' };
    let m = url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]+)/) || url.match(/youtu\.be\/([A-Za-z0-9_-]+)/);
    if (m) return { kind: 'youtube', videoId: m[1] };
    m = url.match(/iframe\.mediadelivery\.net\/embed\/(\d+)\/([0-9a-f-]+)/i);
    if (m) {
      const zone = ZONES[m[1]] || null;
      return { kind: 'bunny', libraryId: m[1], guid: m[2], zone, playlist: zone ? 'https://' + zone + '.b-cdn.net/' + m[2] + '/playlist.m3u8' : null };
    }
    if (/\.m3u8/i.test(url)) return { kind: 'hls', playlist: url };
    if (/\.mp4/i.test(url)) return { kind: 'mp4', url };
    m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) return { kind: 'vimeo', videoId: m[1] };
    return { kind: 'other', url };
  }

  function tokenized(v) {
    const m = v.media || {};
    let url = v.video_url || '';
    if (!url && m.kind === 'bunny') url = 'https://iframe.mediadelivery.net/embed/' + m.libraryId + '/' + m.guid + '?preload=false';
    if (url && v.token && m.kind === 'bunny') {
      url += (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(v.token) + '&expires=' + encodeURIComponent(v.expires || '');
    }
    return url;
  }

  async function apiJson(path) {
    const token = localStorage.getItem('token');
    const res = await origFetch(new URL(path, location.origin).href, {
      headers: Object.assign({ Accept: 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      redirect: 'follow'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function ensureMedia(v) {
    if (v.media && v.media.kind && v.media.kind !== 'none') return v.media;
    const j = await apiJson('/api/videos/' + v.id);
    v.video_url = j.video_url;
    v.media = classify(j.video_url);
    try {
      const t = await apiJson('/api/videos/' + v.id + '/generate-token');
      if (t && t.token) { v.token = t.token; v.expires = t.expires; }
    } catch (e) { /* token optional */ }
    return v.media;
  }

  // ---------------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------------

  function ffmpegCmd(lesson, v) {
    const m = v.media || {};
    if (m.kind !== 'bunny' || !m.playlist) return null;
    const out = 'L' + lesson.id + '-V' + v.id + '.mp4';
    return 'ffmpeg -headers $' + "'" + 'Referer: https://ictfromabc.com/\\r\\nOrigin: https://ictfromabc.com' + "'" +
      ' -i "' + m.playlist + '" -c copy -bsf:a aac_adtstoasc "' + out + '"';
  }

  function ytdlpCmd(lesson, v) {
    const m = v.media || {};
    if (m.kind !== 'youtube' || !m.videoId) return null;
    return 'yt-dlp "https://www.youtube.com/watch?v=' + m.videoId + '" -o "L' + lesson.id + '-V' + v.id + '.%(ext)s"';
  }

  function cliCmd(lesson) {
    return 'node ict-toolkit/cli/ict.mjs download-lesson ' + lesson.id + ' --ffmpeg';
  }

  function manifest() {
    const lines = [];
    lines.push('ICT UNLOCK MANIFEST');
    lines.push('generated: ' + ((DATA && DATA.generatedAt) || new Date().toISOString()));
    lines.push('account course: ' + (localStorage.getItem('course_id') || '2027-al'));
    lines.push('');
    for (const l of visibleLessons()) {
      lines.push('LESSON ' + l.id + '  [' + l.course_id + ']  ' + l.title);
      lines.push('  ' + lessonUrl(l.id));
      for (const v of (l.videos || [])) {
        lines.push('  - VIDEO ' + v.id + '  ' + v.title);
        const url = tokenized(v) || (v.media && (v.media.playlist || v.media.url)) || '';
        if (url) lines.push('    ' + url);
        const f = ffmpegCmd(l, v);
        if (f) lines.push('    ' + f);
        const y = ytdlpCmd(l, v);
        if (y) lines.push('    ' + y);
      }
      lines.push('  CLI: ' + cliCmd(l));
      lines.push('');
    }
    return lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Panel UI
  // ---------------------------------------------------------------------------

  const COURSE_ORDER = ['2027-al', '2026-al', 'al-videos', 'ol-videos', 'git'];
  const expanded = new Set();
  let filter = '';
  let host = null, root = null, bodyEl = null, toastEl = null;

  function lessonUrl(id) { return 'https://ictfromabc.com/dashboard/lessons/' + id + '/videos'; }

  function courseLabel(id) { return COURSE_LABELS[id] || String(id || 'other'); }

  function visibleLessons() {
    const q = filter.trim().toLowerCase();
    const arr = LESSONS.filter(l => accessIds.has(Number(l.id)));
    arr.sort((a, b) => {
      const ai = COURSE_ORDER.indexOf(a.course_id), bi = COURSE_ORDER.indexOf(b.course_id);
      const ao = ai < 0 ? 99 : ai, bo = bi < 0 ? 99 : bi;
      return ao !== bo ? ao - bo : Number(b.id) - Number(a.id);
    });
    if (!q) return arr;
    return arr.filter(l =>
      String(l.title).toLowerCase().includes(q) ||
      String(l.course_id).toLowerCase().includes(q) ||
      (l.videos || []).some(v => String(v.title).toLowerCase().includes(q))
    );
  }

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, Arial, sans-serif; }
    #fab { position: fixed; right: 18px; bottom: 18px; z-index: 2147483647; border: 0; border-radius: 999px;
      padding: 10px 16px; background: #dc2626; color: #fff; font-weight: 700; font-size: 13px; cursor: pointer;
      box-shadow: 0 8px 24px rgba(0,0,0,.35); letter-spacing: .02em; }
    #fab:hover { background: #b91c1c; }
    #panel { position: fixed; right: 18px; bottom: 66px; z-index: 2147483647; width: 560px; max-width: calc(100vw - 24px);
      height: 76vh; max-height: 760px; display: none; flex-direction: column; background: #0b0f14; color: #e5e7eb;
      border: 1px solid #27303b; border-radius: 14px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,.55); }
    #panel.open { display: flex; }
    .hd { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: #111820; border-bottom: 1px solid #27303b; }
    .hd h1 { font-size: 14px; margin: 0; font-weight: 800; letter-spacing: .04em; color: #fff; }
    .hd .stats { font-size: 11px; color: #93a4b8; margin-left: auto; white-space: nowrap; }
    .hd button { border: 1px solid #33414f; background: #18212b; color: #cbd5e1; border-radius: 8px; padding: 5px 8px;
      font-size: 11px; cursor: pointer; }
    .hd button:hover { background: #223041; }
    .bar { display: flex; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #1d2630; background: #0e141a; }
    .bar input { flex: 1; min-width: 0; background: #0b1117; border: 1px solid #2a3644; color: #e5e7eb; border-radius: 8px;
      padding: 7px 10px; font-size: 12px; outline: none; }
    .bar input:focus { border-color: #dc2626; }
    .bar button { border: 1px solid #33414f; background: #18212b; color: #cbd5e1; border-radius: 8px; padding: 7px 10px;
      font-size: 11px; cursor: pointer; white-space: nowrap; }
    .bar button:hover { background: #223041; }
    .bar button.warn { border-color: #7f1d1d; color: #fca5a5; }
    .body { overflow: auto; padding: 10px 12px 16px; flex: 1; }
    .course { margin: 14px 0 6px; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #7c8ea3; }
    .lesson { border: 1px solid #1f2933; border-radius: 10px; margin-bottom: 8px; background: #0f151c; overflow: hidden; }
    .lhead { display: flex; gap: 8px; align-items: center; padding: 9px 10px; cursor: pointer; }
    .lhead:hover { background: #131b24; }
    .lid { font-size: 10px; color: #64748b; font-variant-numeric: tabular-nums; width: 38px; flex: none; }
    .ltitle { flex: 1; font-size: 12px; line-height: 1.35; color: #e2e8f0; }
    .pill { font-size: 10px; padding: 2px 6px; border-radius: 999px; background: #1e293b; color: #93c5fd; white-space: nowrap; }
    .lhead .go { font-size: 10px; color: #f87171; text-decoration: none; white-space: nowrap; }
    .lhead .go:hover { text-decoration: underline; }
    .videos { border-top: 1px solid #1d2630; padding: 4px 0; }
    .video { display: flex; gap: 8px; align-items: center; padding: 7px 10px; border-bottom: 1px solid #141c25; }
    .video:last-child { border-bottom: 0; }
    .vid { font-size: 10px; color: #64748b; width: 38px; flex: none; font-variant-numeric: tabular-nums; }
    .vtitle { flex: 1; font-size: 11.5px; line-height: 1.3; color: #cbd5e1; }
    .kind { font-size: 9px; padding: 2px 5px; border-radius: 4px; font-weight: 700; letter-spacing: .04em; }
    .kind.youtube { background: #3f1d1d; color: #fca5a5; }
    .kind.bunny { background: #12303a; color: #67e8f9; }
    .kind.hls, .kind.mp4 { background: #1e2a3a; color: #93c5fd; }
    .kind.other, .kind.none { background: #26303a; color: #94a3b8; }
    .vbtn { border: 1px solid #2c3947; background: #141d26; color: #94a3b8; border-radius: 6px; padding: 3px 6px;
      font-size: 9.5px; cursor: pointer; white-space: nowrap; }
    .vbtn:hover { color: #fff; border-color: #475569; }
    .vbtn.play { color: #fca5a5; border-color: #7f1d1d; }
    .empty { text-align: center; color: #64748b; font-size: 12px; padding: 40px 10px; }
    #toast { position: fixed; right: 20px; bottom: 20px; z-index: 2147483647; background: #052e16; color: #bbf7d0;
      border: 1px solid #166534; border-radius: 8px; padding: 8px 12px; font-size: 12px; opacity: 0; transition: opacity .2s;
      pointer-events: none; }
    #toast.show { opacity: 1; }
    #overlay { position: fixed; inset: 0; z-index: 2147483647; background: rgba(0,0,0,.82); display: none;
      align-items: center; justify-content: center; padding: 24px; }
    #overlay.open { display: flex; }
    .modal { width: min(1000px, 96vw); background: #0b0f14; border: 1px solid #27303b; border-radius: 12px; overflow: hidden; }
    .mhd { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #111820; border-bottom: 1px solid #27303b; }
    .mhd div { font-size: 12px; color: #e2e8f0; flex: 1; }
    .mhd button { border: 1px solid #33414f; background: #18212b; color: #cbd5e1; border-radius: 8px; padding: 4px 9px;
      font-size: 11px; cursor: pointer; }
    .frame { aspect-ratio: 16 / 9; background: #000; }
    .frame iframe { width: 100%; height: 100%; border: 0; display: block; }
    .mfoot { padding: 8px 12px; display: flex; gap: 8px; }
    .mfoot a { font-size: 11px; color: #f87171; text-decoration: none; }
    .mfoot a:hover { text-decoration: underline; }
  `;

  function build() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'ict-unlock-host';
    (document.body || document.documentElement).appendChild(host);
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<style>' + CSS + '</style>' +
      '<button id="fab">ICT UNLOCK</button>' +
      '<div id="panel"><div class="hd"><h1>ICT UNLOCK</h1><span class="stats"></span>' +
      '<button id="manifest">Manifest</button><button id="close">✕</button></div>' +
      '<div class="bar"><input id="q" placeholder="search lesson / video / course…">' +
      '<button id="scan" class="warn">Rescan access</button></div><div class="body"></div></div>' +
      '<div id="toast"></div><div id="overlay"><div class="modal"><div class="mhd"><div id="mtitle"></div>' +
      '<button id="mclose">Close</button></div><div class="frame" id="mframe"></div>' +
      '<div class="mfoot"><a id="mopen" target="_blank" rel="noopener">open native lesson page ↗</a></div></div></div>';
    bodyEl = root.querySelector('.body');
    toastEl = root.querySelector('#toast');
    root.querySelector('#fab').addEventListener('click', () => toggle());
    root.querySelector('#close').addEventListener('click', () => toggle(false));
    root.querySelector('#manifest').addEventListener('click', () => copy(manifest(), 'manifest copied'));
    root.querySelector('#scan').addEventListener('click', () => scan());
    root.querySelector('#mclose').addEventListener('click', closePlayer);
    root.querySelector('#overlay').addEventListener('click', e => { if (e.target.id === 'overlay') closePlayer(); });
    root.querySelector('#q').addEventListener('input', e => { filter = e.target.value; render(); });
    root.querySelector('.body').addEventListener('click', onBodyClick);
    render();
  }

  function toggle(force) {
    build();
    const panel = root.querySelector('#panel');
    const open = force == null ? !panel.classList.contains('open') : !!force;
    panel.classList.toggle('open', open);
    if (open) render();
  }

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  function copy(text, msg) {
    const done = () => toast(msg || 'copied');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    ta.remove(); done();
  }

  function render() {
    if (!bodyEl) return;
    const list = visibleLessons();
    const vids = list.reduce((n, l) => n + (l.videos ? l.videos.length : 0), 0);
    root.querySelector('.stats').textContent = list.length + ' lessons · ' + vids + ' videos';
    if (!list.length) {
      bodyEl.innerHTML = '<div class="empty">No lessons match. Run “Rescan access”.</div>';
      return;
    }
    let html = '';
    let course = null;
    for (const l of list) {
      if (l.course_id !== course) {
        course = l.course_id;
        html += '<div class="course">' + esc(courseLabel(course)) + ' · ' + esc(course) + '</div>';
      }
      const open = expanded.has(Number(l.id));
      html += '<div class="lesson" data-lid="' + l.id + '">' +
        '<div class="lhead" data-act="toggle" data-lid="' + l.id + '">' +
        '<span class="lid">#' + l.id + '</span><span class="ltitle">' + esc(l.title) + '</span>' +
        '<span class="pill">' + (l.videos ? l.videos.length : 0) + ' vids</span>' +
        '<a class="go" href="' + lessonUrl(l.id) + '" target="_blank" rel="noopener" data-act="stop">open ↗</a></div>';
      if (open) {
        html += '<div class="videos">';
        if (!l.videos || !l.videos.length) {
          html += '<div class="video"><span class="vtitle">No video rows in local data. Open the native page.</span></div>';
        } else {
          for (const v of l.videos) {
            const kind = (v.media && v.media.kind) || 'none';
            html += '<div class="video" data-vid="' + v.id + '" data-lid="' + l.id + '">' +
              '<span class="vid">' + v.id + '</span>' +
              '<span class="vtitle">' + esc(v.title) + '</span>' +
              '<span class="kind ' + esc(kind) + '">' + esc(kind) + '</span>' +
              '<button class="vbtn play" data-act="play" data-lid="' + l.id + '" data-vid="' + v.id + '">play</button>' +
              '<button class="vbtn" data-act="ffmpeg" data-lid="' + l.id + '" data-vid="' + v.id + '">ffmpeg</button>' +
              '<button class="vbtn" data-act="ytdlp" data-lid="' + l.id + '" data-vid="' + v.id + '">yt-dlp</button>' +
              '</div>';
          }
        }
        html += '</div>';
      }
      html += '</div>';
    }
    bodyEl.innerHTML = html;
  }

  function findVideo(lid, vid) {
    const l = LESSON_MAP.get(Number(lid));
    if (!l) return {};
    return { lesson: l, video: (l.videos || []).find(v => Number(v.id) === Number(vid)) };
  }

  async function onBodyClick(e) {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const a = t.closest('[data-act]');
    if (!a) return;
    const act = a.getAttribute('data-act');
    if (act === 'stop') return;
    if (act === 'toggle') {
      e.preventDefault();
      const lid = Number(a.getAttribute('data-lid'));
      if (expanded.has(lid)) expanded.delete(lid); else expanded.add(lid);
      render();
      return;
    }
    const lid = Number(a.getAttribute('data-lid'));
    const vid = Number(a.getAttribute('data-vid'));
    const { lesson, video } = findVideo(lid, vid);
    if (!lesson || !video) return;
    if (act === 'play') {
      e.preventDefault();
      try {
        toast('resolving media…');
        await ensureMedia(video);
        playVideo(lesson, video);
      } catch (err) { toast('media failed: ' + err.message); }
    } else if (act === 'ffmpeg') {
      e.preventDefault();
      try {
        await ensureMedia(video);
        const cmd = ffmpegCmd(lesson, video);
        if (cmd) copy(cmd, 'ffmpeg command copied'); else toast('not a Bunny video');
      } catch (err) { toast('resolve failed: ' + err.message); }
    } else if (act === 'ytdlp') {
      e.preventDefault();
      try {
        await ensureMedia(video);
        const cmd = ytdlpCmd(lesson, video);
        if (cmd) copy(cmd, 'yt-dlp command copied'); else toast('not a YouTube video');
      } catch (err) { toast('resolve failed: ' + err.message); }
    }
  }

  function playVideo(lesson, v) {
    build();
    const src = tokenized(v);
    if (!src) { toast('no playable URL'); return; }
    root.querySelector('#mtitle').textContent = 'L' + lesson.id + ' · V' + v.id + ' — ' + v.title;
    root.querySelector('#mframe').innerHTML = '<iframe src="' + esc(src) + '" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="origin"></iframe>';
    root.querySelector('#mopen').href = lessonUrl(lesson.id);
    root.querySelector('#overlay').classList.add('open');
  }

  function closePlayer() {
    if (!root) return;
    root.querySelector('#overlay').classList.remove('open');
    root.querySelector('#mframe').innerHTML = '';
  }

  async function scan() {
    build();
    const btn = root.querySelector('#scan');
    btn.disabled = true;
    const setStatus = msg => { root.querySelector('.stats').textContent = msg; };
    try {
      setStatus('scanning catalogue…');
      const catalogue = await apiJson('/api/lessons');
      const arr = Array.isArray(catalogue) ? catalogue : (catalogue.lessons || []);
      const found = [];
      for (let i = 0; i < arr.length; i++) {
        const l = arr[i];
        setStatus('testing ' + (i + 1) + '/' + arr.length + ' …');
        try {
          const d = await apiJson('/api/lessons/' + l.id);
          const vids = (d.videos || []).map(v => ({ id: v.id, title: v.title, description: v.description || '', media: null }));
          found.push({ id: l.id, title: l.title, description: l.description || '', course_id: l.course_id, price: l.price, videos: vids });
        } catch (e) { /* locked */ }
        await sleep(1050);
      }
      accessIds = new Set(found.map(l => Number(l.id)));
      saveIds();
      try { localStorage.setItem(SCAN_KEY, JSON.stringify(found)); } catch (e) { /* ignore */ }
      for (const l of found) {
        const existing = LESSON_MAP.get(Number(l.id));
        if (existing) { existing.videos = l.videos; }
        else { LESSONS.push(l); LESSON_MAP.set(Number(l.id), l); }
      }
      render();
      setStatus('found ' + found.length + '/' + arr.length + ' accessible');
      toast('scan complete: ' + found.length + ' lessons');
    } catch (err) {
      setStatus('scan failed: ' + err.message);
      toast('scan failed: ' + err.message);
    } finally {
      btn.disabled = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  function boot() {
    build();
    try {
      const id = new URLSearchParams(location.search).get('ict_unlock');
      if (id === '1') toggle(true);
    } catch (e) { /* ignore */ }
    console.log('[ICT Unlock] v1.0.0 armed — ' + LESSONS.length + ' lessons in data, ' + accessIds.size + ' allowed ids');
  }

  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot, { once: true });

  window.__ICT_UNLOCK = {
    version: '1.0.0',
    data: DATA,
    lessons: () => visibleLessons(),
    ids: () => [...accessIds],
    scan,
    panel: () => toggle(true),
    manifest,
    help() {
      console.log('%cICT Unlock', 'color:#dc2626;font-weight:bold', '\n' +
        '__ICT_UNLOCK.lessons()  list visible lessons\n' +
        '__ICT_UNLOCK.ids()      current allowed id set\n' +
        '__ICT_UNLOCK.scan()     re-test every lesson (rate-limited)\n' +
        '__ICT_UNLOCK.panel()    open the panel\n' +
        '__ICT_UNLOCK.manifest() full text manifest (URLs + commands)\n' +
        'Open the panel with the red ICT UNLOCK button, or ?ict_unlock=1');
    }
  };
})();
