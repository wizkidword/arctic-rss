export type PodcastDirectoryCategorySeed = {
  readonly id: string
  readonly label: string
}

export type PodcastDirectoryShowSeed = {
  readonly artworkUrl: string
  readonly author: string
  readonly categoryId: string
  readonly description: string
  readonly feedUrl: string
  readonly id: string
  readonly title: string
}

export const podcastDirectoryCategories = [
  { id: "ai", label: "AI" },
  { id: "archaeology", label: "Archaeology" },
  { id: "arts", label: "Arts" },
  { id: "books", label: "Books" },
  { id: "business", label: "Business" },
  { id: "careers", label: "Careers" },
  { id: "comedy", label: "Comedy" },
  { id: "culture", label: "Culture" },
  { id: "cybersecurity", label: "Cybersecurity" },
  { id: "economics", label: "Economics" },
  { id: "education", label: "Education" },
  { id: "entertainment", label: "Entertainment" },
  { id: "entrepreneurship", label: "Entrepreneurship" },
  { id: "food", label: "Food" },
  { id: "gaming", label: "Gaming" },
  { id: "health", label: "Health" },
  { id: "history", label: "History" },
  { id: "language-learning", label: "Language Learning" },
  { id: "law", label: "Law" },
  { id: "marketing", label: "Marketing" },
  { id: "medicine", label: "Medicine" },
  { id: "music", label: "Music" },
  { id: "news", label: "News" },
  { id: "parenting", label: "Parenting" },
  { id: "personal-finance", label: "Personal Finance" },
  { id: "philosophy", label: "Philosophy" },
  { id: "politics", label: "Politics" },
  { id: "science", label: "Science" },
  { id: "space", label: "Space" },
  { id: "sports", label: "Sports" },
  { id: "technology", label: "Technology" },
  { id: "travel", label: "Travel" },
  { id: "true-crime", label: "True Crime" },
  { id: "writing", label: "Writing" },
] as const satisfies readonly PodcastDirectoryCategorySeed[]

export const podcastDirectoryShows = [
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/27/a0/ab/27a0abb7-817f-d80c-4fed-6fd04d424333/mza_16804553558295235422.jpg/100x100bb.jpg",
    author: "NPR",
    categoryId: "news",
    description: "Hourly national and world news updates from NPR.",
    feedUrl: "https://feeds.npr.org/500005/podcast.xml",
    id: "npr-news-now",
    title: "NPR News Now",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/0e/35/25/0e352569-e694-81d9-ea55-5f935981c15a/mza_1788275989855583986.png/100x100bb.jpg",
    author: "NPR",
    categoryId: "news",
    description: "Morning news, analysis, and context to start the day.",
    feedUrl: "https://feeds.npr.org/510318/podcast.xml",
    id: "up-first",
    title: "Up First from NPR",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/ab/64/66/ab6466a9-9a7d-e20e-7a3d-bc5be37d29ce/mza_15084852813176276273.jpg/100x100bb.jpg",
    author: "The New York Times",
    categoryId: "news",
    description: "A daily deep dive into the biggest story in the news.",
    feedUrl: "https://feeds.simplecast.com/Sl5CSM3S",
    id: "the-daily",
    title: "The Daily",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/3b/f7/db/3bf7dbc4-b8cc-3b1f-aab3-d5efdc64b1f1/mza_12861866806353468883.jpeg/100x100bb.jpg",
    author: "The Verge",
    categoryId: "technology",
    description: "Technology, gadgets, platforms, policy, and digital culture.",
    feedUrl: "https://feeds.megaphone.fm/vergecast",
    id: "the-vergecast",
    title: "The Vergecast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts126/v4/91/22/42/9122426f-df98-4302-6ba3-da67b0648e70/mza_5041274938111919910.png/100x100bb.jpg",
    author: "Marco Arment, Casey Liss, John Siracusa",
    categoryId: "technology",
    description: "Long-form conversations about Apple, software, and tech.",
    feedUrl: "https://cdn.atp.fm/rss/public?wtvryzdm",
    id: "accidental-tech-podcast",
    title: "Accidental Tech Podcast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/92/dd/8e/92dd8eed-43ec-dc47-50ae-c1ec7c0a3353/mza_3861776104886813687.jpg/100x100bb.jpg",
    author: "MKBHD",
    categoryId: "technology",
    description: "Consumer technology and creator conversations from MKBHD.",
    feedUrl: "https://feeds.megaphone.fm/STU4418364045",
    id: "waveform",
    title: "Waveform: The MKBHD Podcast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/85/df/53/85df5334-0fae-28a9-2bc4-b97b81061d0e/mza_10839245066228881011.jpg/100x100bb.jpg",
    author: "NPR",
    categoryId: "business",
    description: "Smart, story-driven economics and money reporting.",
    feedUrl: "https://feeds.npr.org/510289/podcast.xml",
    id: "planet-money",
    title: "Planet Money",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts126/v4/64/45/06/644506b5-c44f-f661-f74e-f63a4b2511bc/mza_14892199991035639268.jpeg/100x100bb.jpg",
    author: "Guy Raz | Wondery",
    categoryId: "business",
    description: "Startup founders and builders explain how companies get made.",
    feedUrl: "https://rss.art19.com/how-i-built-this",
    id: "how-i-built-this",
    title: "How I Built This with Guy Raz",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/28/4b/4e/284b4e44-9a28-dabf-e853-e60c43e380ad/mza_6581779795008535928.jpg/100x100bb.jpg",
    author: "Harvard Business Review",
    categoryId: "business",
    description: "Management, leadership, workplace, and strategy ideas.",
    feedUrl: "http://feeds.harvardbusiness.org/harvardbusiness/ideacast",
    id: "hbr-ideacast",
    title: "HBR IdeaCast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/17/27/45/17274534-c924-edae-c6ca-c412724c96ae/mza_4098925705315309992.jpg/100x100bb.jpg",
    author: "NPR",
    categoryId: "science",
    description: "Short, approachable science stories and discoveries.",
    feedUrl: "https://feeds.npr.org/510351/podcast.xml",
    id: "short-wave",
    title: "Short Wave",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/d7/88/9b/d7889bab-dca5-77ba-3d0c-7fae8f16ab11/mza_8810454848871508.jpg/100x100bb.jpg",
    author: "Neil deGrasse Tyson",
    categoryId: "science",
    description: "Space, astronomy, physics, and science culture conversations.",
    feedUrl: "https://feeds.simplecast.com/4T39_jAj",
    id: "startalk-radio",
    title: "StarTalk Radio",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts125/v4/44/4e/42/444e42f6-1ce8-1e7b-2d50-4ed506c27004/mza_18370866018545460916.jpg/100x100bb.jpg",
    author: "Alie Ward",
    categoryId: "science",
    description: "Deep, friendly interviews with experts across the sciences.",
    feedUrl: "https://feeds.simplecast.com/FO6kxYGj",
    id: "ologies",
    title: "Ologies with Alie Ward",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/e8/1c/8c/e81c8c2f-a54e-5e7c-3600-22d37012e5a1/mza_10563171041006909060.jpeg/100x100bb.jpg",
    author: "National Aeronautics and Space Administration",
    categoryId: "science",
    description: "NASA stories about space, exploration, research, and discovery.",
    feedUrl:
      "https://feeds.megaphone.fm/NATIONALAERONAUTICSANDSPACEADMINISTRATION8162188566",
    id: "nasas-curious-universe",
    title: "NASA's Curious Universe",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts115/v4/49/b7/eb/49b7eb32-8f08-6fac-aadb-2f002131fe5f/mza_15196161972010256532.jpg/100x100bb.jpg",
    author: "Dan Carlin",
    categoryId: "history",
    description: "Expansive historical storytelling from Dan Carlin.",
    feedUrl: "https://feeds.feedburner.com/dancarlin/history?format=xml",
    id: "hardcore-history",
    title: "Dan Carlin's Hardcore History",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts112/v4/da/e9/e6/dae9e6d3-6b4e-b600-bb37-0ce7833c24d5/mza_9711243178432328693.jpg/100x100bb.jpg",
    author: "Karina Longworth",
    categoryId: "history",
    description: "Stories from Hollywood history and forgotten film culture.",
    feedUrl:
      "https://rss.amperwave.net/v2/feed/audacynetwork/030f6dccce3e28ccc383008872ed4c22",
    id: "you-must-remember-this",
    title: "You Must Remember This",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/20/ed/c7/20edc799-fdb3-e608-a164-0cdaaee63c6b/mza_16701966284979673066.jpg/100x100bb.jpg",
    author: "Goalhanger",
    categoryId: "history",
    description: "Lively history conversations from ancient worlds to modern events.",
    feedUrl: "https://feeds.megaphone.fm/GLT4787413333",
    id: "the-rest-is-history",
    title: "The Rest Is History",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/29/ca/0b/29ca0bf1-aa5b-3da8-9be0-f357793116a7/mza_16337213754400532987.jpg/100x100bb.jpg",
    author: "NPR",
    categoryId: "culture",
    description: "Movies, TV, books, music, and pop culture recommendations.",
    feedUrl: "https://feeds.npr.org/510282/podcast.xml",
    id: "pop-culture-happy-hour",
    title: "Pop Culture Happy Hour",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/79/d0/35/79d035ea-9043-b43e-7380-33cd47bd968b/mza_2606971010425550919.jpg/100x100bb.jpg",
    author: "Roman Mars",
    categoryId: "culture",
    description: "Design, architecture, objects, cities, and hidden systems.",
    feedUrl: "https://feeds.simplecast.com/BqbsxVfO",
    id: "99-percent-invisible",
    title: "99% Invisible",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/0a/c6/53/0ac65311-3ff7-44f7-fd5e-652e84d34cf1/mza_10791381164333289979.jpg/100x100bb.jpg",
    author: "On Being Studios",
    categoryId: "culture",
    description: "Reflective conversations about meaning, culture, and inner life.",
    feedUrl: "https://feeds.simplecast.com/AuAxH_Bf",
    id: "on-being",
    title: "On Being with Krista Tippett",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/d6/ec/33/d6ec332d-41b2-4f6e-3b26-26932d266089/mza_9745793819236520970.jpg/100x100bb.jpg",
    author: "The Ringer",
    categoryId: "sports",
    description: "Sports, media, basketball, football, and culture from Bill Simmons.",
    feedUrl: "https://feeds.megaphone.fm/the-bill-simmons-podcast",
    id: "bill-simmons-podcast",
    title: "The Bill Simmons Podcast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/35/74/6a/35746a0c-7687-7dde-ff04-338d93e78303/mza_10377078556009223546.jpg/100x100bb.jpg",
    author: "Barstool Sports",
    categoryId: "sports",
    description: "Sports conversation, interviews, and daily fan culture.",
    feedUrl: "https://mcsorleys.barstoolsports.com/feed/pardon-my-take",
    id: "pardon-my-take",
    title: "Pardon My Take",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/46/08/68/460868c1-a595-b155-63d2-e58c0940d0d4/mza_455802890697382517.jpg/100x100bb.jpg",
    author: "ESPN, Zach Lowe",
    categoryId: "sports",
    description: "NBA analysis, reporting, and conversations with Zach Lowe.",
    feedUrl: "https://feeds.megaphone.fm/ESP3625084333",
    id: "the-lowe-post",
    title: "The Lowe Post",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/c6/02/8a/c6028ab7-bffd-db83-53e4-34a4ea9bef21/mza_16944101310108746053.jpg/100x100bb.jpg",
    author: "Team Coco & Earwolf",
    categoryId: "comedy",
    description: "Conan O'Brien talks with comedians, actors, and friends.",
    feedUrl: "https://feeds.simplecast.com/dHoohVNH",
    id: "conan-obrien-needs-a-friend",
    title: "Conan O'Brien Needs A Friend",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts122/v4/8b/14/d0/8b14d040-414c-92a6-21f8-04fb72d8d926/mza_13560057034834656474.jpeg/100x100bb.jpg",
    author: "Marc Maron",
    categoryId: "comedy",
    description: "Long-running comedy interviews and candid conversations.",
    feedUrl: "https://feeds.acast.com/public/shows/62a222737c02140013aa4c03",
    id: "wtf-with-marc-maron",
    title: "WTF with Marc Maron Podcast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/e9/94/fe/e994fed6-50a1-6519-9b84-b0beaa205242/mza_2290751556169099993.jpg/100x100bb.jpg",
    author: "NPR",
    categoryId: "comedy",
    description: "News quiz comedy with panelists, interviews, and games.",
    feedUrl: "https://feeds.npr.org/344098539/podcast.xml",
    id: "wait-wait-dont-tell-me",
    title: "Wait Wait... Don't Tell Me!",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/bd/98/22/bd9822cc-b8e0-59de-5809-45926a0ee5f3/mza_2331604259390110897.jpeg/100x100bb.jpg",
    author: "Vox Media Podcast Network",
    categoryId: "true-crime",
    description: "True crime stories with a literary, human-centered style.",
    feedUrl: "https://feeds.megaphone.fm/VMP7924981569",
    id: "criminal",
    title: "Criminal",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/32/81/a3/3281a345-6fa5-1d0d-b0bc-f02b0850a0ae/mza_17562537467118278179.jpeg/100x100bb.jpg",
    author: "Casefile Presents",
    categoryId: "true-crime",
    description: "Detailed true crime cases told in a documentary style.",
    feedUrl: "https://feeds.acast.com/public/shows/679acff465f74095106abfaa",
    id: "casefile-true-crime",
    title: "Casefile True Crime",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/9a/fb/87/9afb8760-0e05-2b3e-24a2-7e14cce74570/mza_14816055607064169808.jpg/100x100bb.jpg",
    author: "Serial Productions & The New York Times",
    categoryId: "true-crime",
    description: "Seasonal investigative storytelling from Serial Productions.",
    feedUrl: "https://feeds.simplecast.com/PpzWFGhg",
    id: "serial",
    title: "Serial",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/68/35/32/683532c0-dd91-676a-eeef-3ace951cd6e9/mza_6896198885971355473.jpg/100x100bb.jpg",
    author: "NPR",
    categoryId: "entertainment",
    description: "Interviews with artists, writers, actors, and cultural voices.",
    feedUrl: "https://feeds.npr.org/381444908/podcast.xml",
    id: "fresh-air",
    title: "Fresh Air",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/83/61/b4/8361b4c7-4b9c-0555-2228-70c8ec5d3870/mza_11815292969908497439.jpg/100x100bb.jpg",
    author: "The Ringer",
    categoryId: "entertainment",
    description: "Television, streaming, film, and pop entertainment analysis.",
    feedUrl: "https://feeds.megaphone.fm/the-watch",
    id: "the-watch",
    title: "The Watch",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/bd/8c/05/bd8c05d9-fd70-e35f-da50-f3d67256d648/mza_6805140787842707960.jpg/100x100bb.jpg",
    author: "Filmspotting",
    categoryId: "entertainment",
    description: "Film reviews, interviews, lists, and cinema conversation.",
    feedUrl:
      "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/d28227f8-56d8-46d9-b2c5-b3d3012db5ab/83c52568-54c6-438a-8751-b3d3012db5c3/podcast.rss",
    id: "filmspotting",
    title: "Filmspotting",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/2c/2c/39/2c2c3938-f8d2-ec71-3e82-3c6b0a7b1957/mza_17520735181545385800.jpeg/100x100bb.jpg",
    author: "The Moth",
    categoryId: "arts",
    description: "True personal stories told live on stage.",
    feedUrl: "http://feeds.feedburner.com/themothpodcast",
    id: "the-moth",
    title: "The Moth",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts115/v4/f5/a1/92/f5a192ba-e932-ca00-c014-6426d73931e1/mza_11459321327818220529.jpg/100x100bb.jpg",
    author: "Design Matters Media",
    categoryId: "arts",
    description: "Long-running conversations with designers and creative leaders.",
    feedUrl: "https://feeds.acast.com/public/shows/67572f5f7205a5bc68e9792a",
    id: "design-matters",
    title: "Design Matters with Debbie Millman",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts116/v4/69/92/17/699217cd-412a-8bad-0718-cdd17d4d7a6b/mza_14134302163801636214.png/100x100bb.jpg",
    author: "Avery Trufelman",
    categoryId: "arts",
    description: "Stories about clothing, design, and the objects we wear.",
    feedUrl: "https://feed.articlesofinterest.club/",
    id: "articles-of-interest",
    title: "Articles of Interest",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts115/v4/e9/4f/b0/e94fb00e-9c7b-1fca-9420-de6cc01a35dc/mza_6086725946585712529.jpg/100x100bb.jpg",
    author: "On Being Studios",
    categoryId: "arts",
    description: "A short, reflective look at a single poem.",
    feedUrl: "https://feeds.simplecast.com/p9JRgDEG",
    id: "poetry-unbound",
    title: "Poetry Unbound",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/ed/71/4f/ed714f67-f095-a4ef-f38e-d8c02300666a/mza_11432355988627368701.jpg/100x100bb.jpg",
    author: "David Senra",
    categoryId: "business",
    description: "Lessons from entrepreneurs and company builders.",
    feedUrl: "https://feeds.megaphone.fm/DSLLC6297708582",
    id: "founders",
    title: "Founders",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/b1/93/5f/b1935f9f-35be-9144-e813-626bd8dabfb4/mza_4132654708551836825.jpg/100x100bb.jpg",
    author: "Jason Bateman, Sean Hayes, Will Arnett",
    categoryId: "comedy",
    description: "Friendly comedy conversations with actors, comics, and creators.",
    feedUrl: "https://feeds.simplecast.com/hNaFxXpO",
    id: "smartless",
    title: "SmartLess",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts126/v4/d9/97/f0/d997f0f5-284b-b90c-16f6-e2e675b831b3/mza_3280114077256997969.jpg/100x100bb.jpg",
    author: "Hidden Brain, Shankar Vedantam",
    categoryId: "culture",
    description: "Science and storytelling about human behavior.",
    feedUrl: "https://feeds.simplecast.com/kwWc0lhf",
    id: "hidden-brain",
    title: "Hidden Brain",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts116/v4/2e/cf/99/2ecf996f-71f7-604f-b0a0-43116b9d6619/mza_10257768296573848480.png/100x100bb.jpg",
    author: "TED",
    categoryId: "education",
    description: "Daily ideas and talks from TED speakers.",
    feedUrl: "https://feeds.acast.com/public/shows/67587e77c705e441797aff96",
    id: "ted-talks-daily",
    title: "TED Talks Daily",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/aa/82/91/aa82912f-23ee-6f6a-583c-a4e993164d0e/mza_12111158076643383507.jpg/100x100bb.jpg",
    author: "iHeartPodcasts",
    categoryId: "education",
    description: "Accessible explainers on the questions people actually ask.",
    feedUrl:
      "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/a91018a4-ea4f-4130-bf55-ae270180c327/44710ecc-10bb-48d1-93c7-ae270180c33e/podcast.rss",
    id: "stuff-you-should-know",
    title: "Stuff You Should Know",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/32/b3/54/32b35421-adbd-c618-356b-b730ceb806a2/mza_9795613643499840489.jpg/100x100bb.jpg",
    author: "Jennifer Gonzalez",
    categoryId: "education",
    description: "Teaching ideas, classroom practice, and learning research.",
    feedUrl: "https://rss.libsyn.com/shows/46945/destinations/157023.xml",
    id: "cult-of-pedagogy",
    title: "The Cult of Pedagogy Podcast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/6f/9b/4c/6f9b4c39-3c1a-d7c7-9264-b0ed14579e08/mza_7947053701740283670.png/100x100bb.jpg",
    author: "No Such Thing As A Fish",
    categoryId: "education",
    description: "Curious facts and smart conversation from the QI researchers.",
    feedUrl: "https://audioboom.com/channels/2399216.rss",
    id: "no-such-thing-as-a-fish",
    title: "No Such Thing As A Fish",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/42/cf/c0/42cfc0bd-e578-719a-e552-0790d1d52dbc/mza_13853945219416376507.jpeg/100x100bb.jpg",
    author: "The Ringer",
    categoryId: "entertainment",
    description: "Film culture, reviews, awards, and industry conversation.",
    feedUrl: "https://feeds.megaphone.fm/the-big-picture",
    id: "the-big-picture",
    title: "The Big Picture",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/2f/86/b8/2f86b835-3646-79db-508b-3dfe2ab5c57f/mza_7794159422468204289.jpeg/100x100bb.jpg",
    author: "Cynthia Graber and Nicola Twilley",
    categoryId: "food",
    description: "Food through the lens of science and history.",
    feedUrl: "https://feeds.megaphone.fm/VMP6255701211",
    id: "gastropod",
    title: "Gastropod",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/34/96/4d/34964dd8-8189-6969-89e2-2b302d0776c3/mza_3467413514116402709.jpg/100x100bb.jpg",
    author: "Dan Pashman",
    categoryId: "food",
    description: "Smart, funny stories about food and the people who eat it.",
    feedUrl: "https://feeds.simplecast.com/n91GPFY5",
    id: "the-sporkful",
    title: "The Sporkful",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/fb/72/12/fb72129b-3dd8-785f-d713-242cad168b86/mza_3652702048540356011.jpg/100x100bb.jpg",
    author: "American Public Media",
    categoryId: "food",
    description: "Conversations and recipes for curious cooks and eaters.",
    feedUrl: "https://feeds.publicradio.org/public_feeds/the-splendid-table",
    id: "the-splendid-table",
    title: "The Splendid Table",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/ca/47/a1/ca47a194-8f1e-c653-523a-2a9b37140abe/mza_1432906808072287730.png/100x100bb.jpg",
    author: "KCRW",
    categoryId: "food",
    description: "Food culture, restaurants, cooking, and market reporting.",
    feedUrl:
      "https://feed.cdnstream1.com/zjb/feed/download/4b/e5/cc/4be5cc7b-8528-4b9e-8981-08d89bcff381.xml",
    id: "good-food",
    title: "Good Food",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/9a/d3/19/9ad31912-0b5a-a16e-2d7c-9fd074698b9c/mza_8994222203629500925.jpg/100x100bb.jpg",
    author: "Scicomm Media",
    categoryId: "health",
    description: "Neuroscience, health, performance, and behavior.",
    feedUrl: "https://feeds.megaphone.fm/hubermanlab",
    id: "huberman-lab",
    title: "Huberman Lab",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts115/v4/ad/99/b3/ad99b35e-bd23-1c62-dcc6-fcd390522c1d/mza_17138371392652580584.jpg/100x100bb.jpg",
    author: "TED",
    categoryId: "health",
    description: "Health ideas, research, and personal stories from TED.",
    feedUrl: "https://feeds.acast.com/public/shows/67585b08102e6d4448d360b1",
    id: "ted-health",
    title: "TED Health",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/6e/ab/0c/6eab0c49-9bac-1cb3-3414-90b2ead4cb41/mza_14686075280957800769.jpg/100x100bb.jpg",
    author: "Mari Llewellyn & Pursuit Network",
    categoryId: "health",
    description: "Wellness, mental health, habits, and personal growth.",
    feedUrl: "https://feeds.megaphone.fm/SSM3257074871",
    id: "pursuit-of-wellness",
    title: "Pursuit of Wellness",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/f8/1e/93/f81e9349-1f81-0901-06e2-9fcb97f916ce/mza_6543407769057947677.jpg/100x100bb.jpg",
    author: "iHeartPodcasts",
    categoryId: "health",
    description: "Mental health and life lessons for young adults.",
    feedUrl:
      "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/bc44988a-a82a-4291-ab8b-afdd01187fa8/39e2f432-53df-43b8-a7b9-afdd01187fc4/podcast.rss",
    id: "psychology-of-your-20s",
    title: "The Psychology of your 20s",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/91/6b/89/916b8925-278d-0d3f-4968-ce8112e372be/mza_11125061227071811319.jpg/100x100bb.jpg",
    author: "iHeartPodcasts",
    categoryId: "history",
    description: "Lesser-known stories from across history.",
    feedUrl:
      "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/cfb428ef-eafc-44d0-9d09-ae2701747e6f/fb626e1f-112c-4246-a40d-ae2701747e7d/podcast.rss",
    id: "stuff-you-missed-in-history-class",
    title: "Stuff You Missed in History Class",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/51/f9/47/51f947e8-c136-a10d-8ba1-b224a46cabf0/mza_8709210704953623321.png/100x100bb.jpg",
    author: "StoryBrand.com",
    categoryId: "marketing",
    description: "Clearer messaging and marketing systems for growing businesses.",
    feedUrl: "https://rss.libsyn.com/shows/350081/destinations/2860682.xml",
    id: "marketing-made-simple",
    title: "Marketing Made Simple",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/8e/07/93/8e079362-34c2-d2bd-6944-0b2ca35e470f/mza_17827701165108339903.jpeg/100x100bb.jpg",
    author: "Eric Siu and Neil Patel",
    categoryId: "marketing",
    description: "Short digital marketing and growth tactics.",
    feedUrl: "https://feeds.megaphone.fm/ESHO5419936864",
    id: "marketing-school",
    title: "Marketing School",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts113/v4/09/53/d3/0953d3e2-c1fb-1741-02eb-c5ac576d2cd2/mza_7059938016176568118.jpg/100x100bb.jpg",
    author: "John Wall and Christopher Penn",
    categoryId: "marketing",
    description: "Marketing news and tactics over coffee-length conversations.",
    feedUrl: "http://feeds.feedburner.com/marketingovercoffee",
    id: "marketing-over-coffee",
    title: "Marketing Over Coffee",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/12/52/74/125274ab-6f14-e90d-2b87-73b81a622e0a/mza_18393515196811820848.jpeg/100x100bb.jpg",
    author: "Jenna Kutcher",
    categoryId: "marketing",
    description: "Marketing for creators, entrepreneurs, and small businesses.",
    feedUrl: "https://feeds.megaphone.fm/YAP4895144602",
    id: "goal-digger",
    title: "The Goal Digger Podcast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/d5/51/f3/d551f39b-5155-ba29-e9d6-6325099c751c/mza_16349419746751364369.png/100x100bb.jpg",
    author: "NPR",
    categoryId: "music",
    description: "Music interviews, discoveries, and criticism from NPR.",
    feedUrl: "https://feeds.npr.org/510019/podcast.xml",
    id: "npr-music",
    title: "NPR Music",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/83/7a/0c/837a0c71-c72e-898c-a9eb-cbb2e1737880/mza_17854632789334152259.jpg/100x100bb.jpg",
    author: "NPR",
    categoryId: "music",
    description: "Tiny Desk Concert audio from NPR Music.",
    feedUrl: "https://feeds.npr.org/510306/podcast.xml",
    id: "tiny-desk-concerts",
    title: "Tiny Desk Concerts - Audio",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/5e/ab/d6/5eabd69e-6426-d14a-d28a-19922fafdb03/mza_6450352487665525107.jpg/100x100bb.jpg",
    author: "The Ringer",
    categoryId: "music",
    description: "Pop music history through defining songs.",
    feedUrl: "https://feeds.megaphone.fm/60-songs",
    id: "sixty-songs-that-explain-the-90s",
    title: "60 Songs That Explain the '90s",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts124/v4/88/18/59/881859a5-f344-c249-f4b9-3d9b62add05a/mza_16428964146354887078.png/100x100bb.jpg",
    author: "Andrew Hickey",
    categoryId: "music",
    description: "A deep history of rock music, one song at a time.",
    feedUrl: "https://500songs.com/feed/podcast/a-history-of-rock-music-in-500-songs/",
    id: "history-of-rock-music-in-500-songs",
    title: "A History of Rock Music in 500 Songs",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/84/57/09/8457093f-677a-d6de-5666-6514cc588a7e/mza_17083078915388787537.jpg/100x100bb.jpg",
    author: "BBC World Service",
    categoryId: "news",
    description: "International news and analysis from the BBC.",
    feedUrl: "https://podcasts.files.bbci.co.uk/p02nq0gn.rss",
    id: "global-news-podcast",
    title: "Global News Podcast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/e1/00/d5/e100d55c-1801-e556-98e2-3cf1e21ecab8/mza_7728431977720310610.jpeg/100x100bb.jpg",
    author: "Andrew Giancola",
    categoryId: "personal-finance",
    description: "Practical money habits, investing, and financial planning.",
    feedUrl: "https://feeds.megaphone.fm/LLL5449685314",
    id: "personal-finance-podcast",
    title: "The Personal Finance Podcast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/c5/62/a7/c562a785-4edf-d22b-dbb7-994037c9f2d6/mza_149898594603054178.png/100x100bb.jpg",
    author: "NerdWallet Personal Finance",
    categoryId: "personal-finance",
    description: "Consumer-friendly money advice from NerdWallet.",
    feedUrl: "https://rss.pdrl.fm/3c99ea/feeds.megaphone.fm/NRD2548999404",
    id: "nerdwallet-smart-money",
    title: "NerdWallet's Smart Money Podcast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/bd/af/e8/bdafe8ff-a67c-8580-bdd8-33207d5a7df3/mza_6955685324627963771.jpg/100x100bb.jpg",
    author: "Brian Preston and Bo Hanson",
    categoryId: "personal-finance",
    description: "Personal finance, investing, and retirement planning.",
    feedUrl: "https://feeds.megaphone.fm/moneyguyshow",
    id: "money-guy-show",
    title: "Money Guy Show",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts123/v4/cc/04/3a/cc043a0a-fced-5945-e049-8352fb239bdf/mza_7055126549215925084.jpg/100x100bb.jpg",
    author: "Pete Matthew",
    categoryId: "personal-finance",
    description: "Plain-spoken financial planning and money education.",
    feedUrl: "https://meaningfulmoney.libsyn.com/rss",
    id: "meaningful-money",
    title: "The Meaningful Money Personal Finance Podcast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/44/dc/61/44dc6141-25e9-5bb3-e19e-a2337233d19e/mza_5506771870755587769.jpg/100x100bb.jpg",
    author: "Pod Save America",
    categoryId: "politics",
    description: "Progressive political analysis and interviews.",
    feedUrl: "https://audioboom.com/channels/5166624.rss",
    id: "pod-save-america",
    title: "Pod Save America",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/71/15/1d/71151d33-32e7-f0e1-2a6b-412bf4835c5d/mza_9550948332778108059.jpg/100x100bb.jpg",
    author: "NPR",
    categoryId: "politics",
    description: "Election, policy, and government reporting from NPR.",
    feedUrl: "https://feeds.npr.org/510310/podcast.xml",
    id: "npr-politics-podcast",
    title: "The NPR Politics Podcast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts116/v4/e3/07/89/e30789af-e7d0-bb29-8cf8-ae3b9cfe4316/mza_2484307396739987098.jpg/100x100bb.jpg",
    author: "The Bulwark",
    categoryId: "politics",
    description: "Political analysis, interviews, and commentary.",
    feedUrl: "https://audioboom.com/channels/5114286.rss",
    id: "the-bulwark-podcast",
    title: "The Bulwark Podcast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/7f/fa/ad/7ffaad06-512e-6ce7-c636-6f81a2312368/mza_11493862159505710824.jpg/100x100bb.jpg",
    author: "iHeartPodcasts",
    categoryId: "politics",
    description: "Fast-moving political conversations and interviews.",
    feedUrl:
      "https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/5900456b-1613-453b-b072-af1201655554/e44eee4e-0508-4c4d-bca4-af120165bf69/podcast.rss",
    id: "fast-politics",
    title: "Fast Politics with Molly Jong-Fast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/62/15/18/621518e5-8eb3-392b-25a7-e7444aab86b6/mza_815589518502039493.jpg/100x100bb.jpg",
    author: "Spotify Studios",
    categoryId: "science",
    description: "Science stories that test claims, trends, and popular ideas.",
    feedUrl: "https://feeds.megaphone.fm/sciencevs",
    id: "science-vs",
    title: "Science Vs",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/68/1e/d6/681ed614-6219-98e7-22bd-d83ee99a8f61/mza_15062856999140050346.jpeg/100x100bb.jpg",
    author: "Wondery",
    categoryId: "sports",
    description: "Football, sports culture, and conversations with Jason and Travis Kelce.",
    feedUrl: "https://rss.art19.com/new-heights",
    id: "new-heights",
    title: "New Heights with Jason & Travis Kelce",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/c3/30/67/c330676b-2402-432b-0505-12490dc3ccc1/mza_4262545472677654397.jpeg/100x100bb.jpg",
    author: "Alex Kantrowitz",
    categoryId: "technology",
    description: "Reporting and interviews about the tech industry.",
    feedUrl: "https://feeds.megaphone.fm/LI3617121267",
    id: "big-technology-podcast",
    title: "Big Technology Podcast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/ae/08/83/ae088306-bdd2-d8e9-d7a0-8157876106ac/mza_3960900746207066868.png/100x100bb.jpg",
    author: "Mile Higher Media & Audioboom Studios",
    categoryId: "true-crime",
    description: "True crime cases and victim-centered storytelling.",
    feedUrl: "https://audioboom.com/channels/5074524.rss",
    id: "true-crime-with-kendall-rae",
    title: "True Crime with Kendall Rae",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/72/7a/be/727abe96-2e44-d9ac-a6d9-7226372b5eb9/mza_6848050469316823102.jpg/100x100bb.jpg",
    author: "Practical AI LLC",
    categoryId: "ai",
    description: "Machine learning, data science, LLMs, and applied AI work.",
    feedUrl: "https://feeds.transistor.fm/practical-ai-machine-learning-data-science-llm",
    id: "practical-ai",
    title: "Practical AI",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/2d/c3/b1/2dc3b1c6-2170-e926-04d0-0aaabf848eff/mza_2266632206147105925.jpg/100x100bb.jpg",
    author: "Latent.Space",
    categoryId: "ai",
    description: "Technical conversations for AI engineers and builders.",
    feedUrl: "https://api.substack.com/feed/podcast/1084089.rss",
    id: "latent-space",
    title: "Latent Space: The AI Engineer Podcast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/9c/78/d8/9c78d82d-a2d1-a026-6ca2-f92ea61be9ae/mza_18421328158594577747.jpg/100x100bb.jpg",
    author: "Nathaniel Whittemore",
    categoryId: "ai",
    description: "Daily artificial intelligence news and analysis.",
    feedUrl: "https://anchor.fm/s/f7cac464/podcast/rss",
    id: "ai-daily-brief",
    title: "The AI Daily Brief",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/8f/46/88/8f4688ec-087f-28a1-7f6d-0d401d2e8a00/mza_14043856542292072583.jpg/100x100bb.jpg",
    author: "Conviction",
    categoryId: "ai",
    description: "AI, technology, startups, and research conversations.",
    feedUrl: "https://feeds.megaphone.fm/nopriors",
    id: "no-priors",
    title: "No Priors",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/96/e9/9e/96e99e00-7e24-3583-86fa-693b3b174597/mza_16184389970023055458.jpeg/100x100bb.jpg",
    author: "The New York Times",
    categoryId: "books",
    description: "Book reviews, author interviews, and literary conversation.",
    feedUrl: "https://feeds.simplecast.com/zyaxg_KL",
    id: "the-book-review",
    title: "The Book Review",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/fd/66/54/fd6654a5-b4f6-e559-0d8f-a68410c2b4d9/mza_12628019473224715704.jpeg/100x100bb.jpg",
    author: "Anne Bogel",
    categoryId: "books",
    description: "Personalized book recommendations for readers.",
    feedUrl: "https://rss.pdrl.fm/009d1c/feeds.megaphone.fm/ARML2867767043",
    id: "what-should-i-read-next",
    title: "What Should I Read Next?",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts126/v4/5b/a9/12/5ba9124a-eb6d-6fcc-bd8e-75de88b73517/mza_5106699898373276155.jpg/100x100bb.jpg",
    author: "LeVar Burton and Stitcher",
    categoryId: "books",
    description: "Short fiction performed by LeVar Burton.",
    feedUrl: "https://feeds.simplecast.com/LDNgBXht",
    id: "levar-burton-reads",
    title: "LeVar Burton Reads",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/0c/c5/2e/0cc52e90-5f19-7f19-098e-1d5526fd1a7e/mza_5544002770764984942.jpg/100x100bb.jpg",
    author: "Book Riot",
    categoryId: "books",
    description: "News, recommendations, and conversation for book people.",
    feedUrl: "https://rss.pdrl.fm/bddf6c/feeds.megaphone.fm/RNMG7301081241",
    id: "book-riot",
    title: "Book Riot - The Podcast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts122/v4/3a/80/a7/3a80a7db-5620-f77b-9935-016e61cc2fbc/mza_9399859904175514567.jpg/100x100bb.jpg",
    author: "Jack Rhysider",
    categoryId: "cybersecurity",
    description: "True stories from the dark side of the internet.",
    feedUrl: "https://podcast.darknetdiaries.com",
    id: "darknet-diaries",
    title: "Darknet Diaries",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts116/v4/a1/be/2b/a1be2b5b-416d-eb8b-f008-dbf8f4dad378/mza_13520720204623959175.jpg/100x100bb.jpg",
    author: "TWiT",
    categoryId: "cybersecurity",
    description: "Security news, privacy, vulnerabilities, and analysis.",
    feedUrl: "https://rss.pdrl.fm/f84ea4/feeds.twit.tv/sn.xml",
    id: "security-now",
    title: "Security Now",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/1d/66/6e/1d666ea1-3a60-2f08-5f33-289a9fd2c615/mza_12772964251805831040.jpeg/100x100bb.jpg",
    author: "N2K Networks",
    categoryId: "cybersecurity",
    description: "Daily cybersecurity news and threat intelligence.",
    feedUrl: "https://rss.pdrl.fm/85df76/feeds.megaphone.fm/cyberwire-daily-podcast",
    id: "cyberwire-daily",
    title: "CyberWire Daily",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/ab/1b/98/ab1b98b1-a647-5bda-d4cd-e9937c2254de/mza_8709271612325930559.png/100x100bb.jpg",
    author: "Risky Business Media",
    categoryId: "cybersecurity",
    description: "Security industry news, research, and interviews.",
    feedUrl: "https://risky.biz/feeds/risky-business/",
    id: "risky-business",
    title: "Risky Business",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts122/v4/6d/99/43/6d99438d-3f7c-4449-f77e-cf70123b0ce8/mza_9547249688201563314.jpg/100x100bb.jpg",
    author: "Kinda Funny",
    categoryId: "gaming",
    description: "Daily video game news and industry conversation.",
    feedUrl: "https://feeds.megaphone.fm/ROOSTER8838278962",
    id: "kinda-funny-games-daily",
    title: "Kinda Funny Games Daily",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Features2/v4/d4/f6/47/d4f64716-423e-8403-851d-a8e107bbe769/mza_4624406836823011967.jpg/100x100bb.jpg",
    author: "IGN & Geek Media",
    categoryId: "gaming",
    description: "Video game news, trivia, reviews, and discussion.",
    feedUrl: "https://rss.pdrl.fm/817ebc/feeds.megaphone.fm/gamescoop",
    id: "game-scoop",
    title: "Game Scoop!",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/6f/fe/dd/6ffedd89-9fe7-506e-f0cf-5b8f11086211/mza_15027410562939629576.jpg/100x100bb.jpg",
    author: "Maximum Fun",
    categoryId: "gaming",
    description: "Game criticism, industry talk, and what to play next.",
    feedUrl: "https://feeds.simplecast.com/6WD3bDj7",
    id: "triple-click",
    title: "Triple Click",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts116/v4/23/1e/6d/231e6db3-e2c9-ba9d-1078-cbb39720f53e/mza_12492063569871417850.jpg/100x100bb.jpg",
    author: "MinnMax",
    categoryId: "gaming",
    description: "Video game news, reviews, and community conversations.",
    feedUrl: "https://pinecast.com/feed/the-minnmax-show",
    id: "the-minnmax-show",
    title: "The MinnMax Show",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/ce/43/fd/ce43fdee-824d-b97c-3642-959e971579c2/mza_9334100872530662650.jpg/100x100bb.jpg",
    author: "Good Inside",
    categoryId: "parenting",
    description: "Parenting tools and advice from Dr. Becky.",
    feedUrl: "https://feeds.simplecast.com/Y5N0xWWZ",
    id: "good-inside",
    title: "Good Inside with Dr. Becky",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/85/d6/f9/85d6f951-fd78-51cf-ed61-3b88739e6ef2/mza_8989932716973122738.jpeg/100x100bb.jpg",
    author: "Aliza Pressman",
    categoryId: "parenting",
    description: "Science-backed guidance for raising resilient kids.",
    feedUrl: "https://feeds.megaphone.fm/RRE8465566885",
    id: "raising-good-humans",
    title: "Raising Good Humans",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/ca/60/a0/ca60a0e5-e4b7-fa11-b9b5-d9a347571687/mza_14522851872506518979.jpeg/100x100bb.jpg",
    author: "JLML Press",
    categoryId: "parenting",
    description: "Respectful parenting advice from Janet Lansbury.",
    feedUrl: "https://feeds.megaphone.fm/ADL8169230773",
    id: "janet-lansbury-unruffled",
    title: "Respectful Parenting: Janet Lansbury Unruffled",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/4c/b0/4a/4cb04a06-4e0a-d534-2a28-3f2fb37fa14e/mza_14610475686329584932.jpeg/100x100bb.jpg",
    author: "Tinkercast",
    categoryId: "parenting",
    description: "Science and curiosity for kids and families.",
    feedUrl: "https://rss.art19.com/wow-in-the-world",
    id: "wow-in-the-world",
    title: "Wow in the World",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/c1/b7/51/c1b751eb-ab38-f11c-d6c1-0a9de79b7061/mza_12134548126279202007.jpg/100x100bb.jpg",
    author: "Stephen West",
    categoryId: "philosophy",
    description: "Accessible philosophy from ancient ideas to modern life.",
    feedUrl: "https://rss.libsyn.com/shows/623035/destinations/5482110.xml",
    id: "philosophize-this",
    title: "Philosophize This!",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts114/v4/32/eb/a9/32eba9ac-dfb0-618b-e874-6696c69ea59d/mza_257738567509116492.jpeg/100x100bb.jpg",
    author: "Mark Linsenmayer, Wes Alwan, Seth Paskin, Dylan Casey",
    categoryId: "philosophy",
    description: "Deep conversations about classic and modern philosophy.",
    feedUrl: "https://rss.libsyn.com/shows/19421/destinations/16399.xml",
    id: "partially-examined-life",
    title: "The Partially Examined Life Philosophy Podcast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts115/v4/01/76/52/01765219-d70c-a243-1924-0c5651c8604d/mza_11881655681855403902.jpg/100x100bb.jpg",
    author: "Peter Adamson",
    categoryId: "philosophy",
    description: "A broad history of philosophy, one episode at a time.",
    feedUrl: "https://feed.podbean.com/hopwag/feed.xml",
    id: "history-of-philosophy-without-any-gaps",
    title: "History of Philosophy Without Any Gaps",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/84/25/f5/8425f5c3-ce22-db1a-3e55-1a6698cc7f03/mza_3273078451247345185.jpeg/100x100bb.jpg",
    author: "Vox",
    categoryId: "philosophy",
    description: "Ideas, ethics, politics, and the questions behind public life.",
    feedUrl: "https://feeds.megaphone.fm/theezrakleinshow",
    id: "the-gray-area",
    title: "The Gray Area with Sean Illing",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/87/98/25/879825ac-a741-1953-516a-772b5d0b8ef3/mza_9400748020880281408.jpg/100x100bb.jpg",
    author: "Jason Moore",
    categoryId: "travel",
    description: "Long-term travel, remote work, and life on the road.",
    feedUrl: "https://rss.introcast.io/778339885/feeds.megaphone.fm/ZTTIA6764283121",
    id: "zero-to-travel",
    title: "Zero To Travel Podcast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts125/v4/07/e9/e7/07e9e75b-7ba1-b99e-64bf-7aad2cdda336/mza_18046591300306403493.jpg/100x100bb.jpg",
    author: "Rick Steves",
    categoryId: "travel",
    description: "Travel stories, advice, and destinations from Rick Steves.",
    feedUrl: "http://www.ricksteves.com/rss/podcast",
    id: "travel-with-rick-steves",
    title: "Travel with Rick Steves",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/76/8b/57/768b5761-8409-0130-3e5c-2efab9d664a6/mza_5930465217643371452.jpg/100x100bb.jpg",
    author: "Chris Christensen",
    categoryId: "travel",
    description: "Destination guides and travel stories from around the world.",
    feedUrl: "https://feeds.megaphone.fm/GLSS1857986358",
    id: "amateur-traveler",
    title: "Travel with Amateur Traveler Podcast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/b6/4b/89/b64b8924-2a6b-c1ec-119b-5653ef92af0d/mza_8007067242365469711.jpeg/100x100bb.jpg",
    author: "Conde Nast Traveler",
    categoryId: "travel",
    description: "Travel stories, advice, and conversations from women travelers.",
    feedUrl: "https://feeds.megaphone.fm/CNE7076568850",
    id: "women-who-travel",
    title: "Women Who Travel",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/88/37/4e/88374e1c-f38f-a9ac-b1be-91fb0d51c0f7/mza_13942176398001872848.jpg/100x100bb.jpg",
    author: "Joanna Penn",
    categoryId: "writing",
    description: "Writing, publishing, and creative business for authors.",
    feedUrl: "https://www.thecreativepenn.com/feed/podcast/",
    id: "creative-penn",
    title: "The Creative Penn Podcast For Writers",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts116/v4/07/59/fb/0759fb7c-0db1-504e-403f-b5251359ff48/mza_4110502297519913825.jpg/100x100bb.jpg",
    author: "Writing Excuses",
    categoryId: "writing",
    description: "Short lessons and discussions for fiction writers.",
    feedUrl: "https://feeds.redcircle.com/848724f4-c420-4a75-b4be-fa3db1e46546",
    id: "writing-excuses",
    title: "Writing Excuses",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts122/v4/89/5e/4b/895e4b3f-475d-06b7-c174-6f60b46ae641/mza_6078836133422770137.jpeg/100x100bb.jpg",
    author: "Kelton Reid",
    categoryId: "writing",
    description: "Writing habits, productivity, creativity, and craft.",
    feedUrl: "https://feeds.megaphone.fm/TPG5286564987",
    id: "writer-files",
    title: "The Writer Files",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/f5/5b/bb/f55bbbd8-d00f-733a-e19a-1d4d234ffdbe/mza_5090015985788464869.jpg/100x100bb.jpg",
    author: "QuickAndDirtyTips.com",
    categoryId: "writing",
    description: "Grammar, language, and practical writing advice.",
    feedUrl: "https://feeds.acast.com/public/shows/69c1476c007cdcf83fc0964b",
    id: "grammar-girl",
    title: "Grammar Girl",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts126/v4/6c/94/31/6c943113-5484-a41d-5cb7-bf606ff289ef/mza_6401313720037127611.jpeg/100x100bb.jpg",
    author: "History Hit",
    categoryId: "archaeology",
    description: "Ancient history, archaeology, and the cultures that shaped the world.",
    feedUrl: "https://access.acast.com/rss/f2925f7a-eb08-471a-9958-387cb5ee6353",
    id: "the-ancients",
    title: "The Ancients",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/91/cb/bc/91cbbc5d-aa6e-123c-0da9-618f22b2fed9/mza_14363323877534205703.jpeg/100x100bb.jpg",
    author: "Patrick Wyman",
    categoryId: "archaeology",
    description: "Deep historical context from prehistory through the modern world.",
    feedUrl: "https://rss.art19.com/tides-of-history",
    id: "tides-of-history",
    title: "Tides of History",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/86/63/56/86635691-554e-b600-8c66-c1074a6a661d/mza_10852883160787441689.jpg/100x100bb.jpg",
    author: "Archaeology Podcast Network",
    categoryId: "archaeology",
    description: "Archaeology news, discoveries, and field conversations.",
    feedUrl: "https://feeds.simplecast.com/MGJ78Sv7",
    id: "the-archaeology-show",
    title: "The Archaeology Show",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts122/v4/f1/96/33/f1963322-eda5-5c9f-3e79-6e751924c14e/mza_2215059003106526372.jpg/100x100bb.jpg",
    author: "The Dirt Podcast",
    categoryId: "archaeology",
    description: "Archaeology, ancient cultures, and material history.",
    feedUrl: "https://feeds.captivate.fm/the-dirt-podcast/",
    id: "the-dirt-podcast",
    title: "The Dirt Podcast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/42/9e/13/429e13c5-6109-0501-ae45-393498ee9672/mza_8552911192466246567.jpeg/100x100bb.jpg",
    author: "TED",
    categoryId: "careers",
    description: "Workplace lessons, management ideas, and career reflection.",
    feedUrl: "https://feeds.acast.com/public/shows/67585d9cc705e441796ddaf6",
    id: "worklife-with-molly-graham",
    title: "Worklife with Molly Graham",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/4d/0c/08/4d0c08aa-f621-c138-6fd5-12dc357725d2/mza_2356883204884725033.jpeg/100x100bb.jpg",
    author: "Career Contessa",
    categoryId: "careers",
    description: "Career growth, job search, leadership, and work-life advice.",
    feedUrl: "https://rss.art19.com/career-contessa",
    id: "career-contessa",
    title: "Career Contessa",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts113/v4/ee/91/f0/ee91f0e5-ac68-59f7-7873-c87c5db2743a/mza_1348266336693671042.jpg/100x100bb.jpg",
    author: "Manager Tools",
    categoryId: "careers",
    description: "Practical tools for resumes, interviews, and career management.",
    feedUrl: "https://files.manager-tools.com/public/feeds/career_tools_podcasts.xml",
    id: "career-tools",
    title: "Career Tools",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts126/v4/94/39/2b/94392bb1-5c53-fb22-0fa1-072de612c9ce/mza_7909751048745982194.jpg/100x100bb.jpg",
    author: "Scott Anthony Barlow",
    categoryId: "careers",
    description: "Career change, meaningful work, and job search strategy.",
    feedUrl: "https://rss.libsyn.com/shows/47697/destinations/161278.xml",
    id: "happen-to-your-career",
    title: "Happen To Your Career",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts115/v4/f7/0c/c5/f70cc540-ce36-d96f-b111-c970aad5505c/mza_17703422762227531425.jpg/100x100bb.jpg",
    author: "Freakonomics Radio",
    categoryId: "economics",
    description: "Economics, incentives, behavior, and surprising questions.",
    feedUrl: "https://feeds.simplecast.com/Y8lFbOT4",
    id: "freakonomics-radio",
    title: "Freakonomics Radio",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts115/v4/a0/13/c5/a013c54f-362a-670d-a75c-1c5486dfc40f/mza_6055952261821533990.jpg/100x100bb.jpg",
    author: "Russ Roberts",
    categoryId: "economics",
    description: "Long-form economics conversations with authors and thinkers.",
    feedUrl: "https://feeds.simplecast.com/wgl4xEgL",
    id: "econtalk",
    title: "EconTalk",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/52/43/7a/52437a60-2f82-5abd-e65a-77e1a4fc41c2/mza_16254826952631581399.jpg/100x100bb.jpg",
    author: "NPR",
    categoryId: "economics",
    description: "Short economic stories that explain work, money, and markets.",
    feedUrl: "https://feeds.npr.org/510325/podcast.xml",
    id: "the-indicator",
    title: "The Indicator from Planet Money",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/8f/b4/98/8fb4983c-4873-da05-599e-e528c85e4cf9/mza_13474228678195417545.jpeg/100x100bb.jpg",
    author: "The Economist",
    categoryId: "economics",
    description: "Business, markets, finance, and the forces shaping the economy.",
    feedUrl: "https://access.acast.com/rss/39fc4a99-8861-437d-81e2-684d13e48f92",
    id: "money-talks",
    title: "Money Talks from The Economist",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/13/4b/81/134b8173-d713-cbb2-2d3b-4a8692bd87c0/mza_996010941061703843.jpeg/100x100bb.jpg",
    author: "WaitWhat",
    categoryId: "entrepreneurship",
    description: "How founders and leaders build enduring companies.",
    feedUrl: "https://rss.art19.com/masters-of-scale",
    id: "masters-of-scale",
    title: "Masters of Scale",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/2a/5e/4d/2a5e4df0-8f2f-c5c7-1be9-4d220778f967/mza_12868536899493151042.jpeg/100x100bb.jpg",
    author: "HubSpot Media",
    categoryId: "entrepreneurship",
    description: "Business ideas, startups, internet companies, and founder stories.",
    feedUrl: "https://feeds.megaphone.fm/HS2300184645",
    id: "my-first-million",
    title: "My First Million",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/93/25/c5/9325c5e1-dab6-d45e-b216-f991a0ee1eb4/mza_2098135419115921329.png/100x100bb.png",
    author: "Rob Walling",
    categoryId: "entrepreneurship",
    description: "Bootstrapping, SaaS, and building independent startups.",
    feedUrl: "https://feeds.castos.com/mqv6",
    id: "startups-for-the-rest-of-us",
    title: "Startups For the Rest of Us",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/43/c5/fb/43c5fbdf-b302-053a-2704-ba5f74322625/mza_13119989780540450831.jpg/100x100bb.jpg",
    author: "Ben Gilbert and David Rosenthal",
    categoryId: "entrepreneurship",
    description: "Company histories, strategy, and business model deep dives.",
    feedUrl: "https://feeds.transistor.fm/acquired",
    id: "acquired",
    title: "Acquired",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts115/v4/aa/a0/f5/aaa0f562-64a8-401f-bfe8-7b6a49ec5943/mza_2619062143639023486.png/100x100bb.jpg",
    author: "Duolingo",
    categoryId: "language-learning",
    description: "Spanish learning through real stories in easy-to-follow episodes.",
    feedUrl: "https://anchor.fm/s/fc714074/podcast/rss",
    id: "duolingo-spanish",
    title: "Duolingo Spanish Podcast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts115/v4/8c/60/bb/8c60bbc0-0bfb-13c9-ec70-ec7812061d5e/mza_3440928626851101255.jpg/100x100bb.jpg",
    author: "Coffee Break Languages",
    categoryId: "language-learning",
    description: "Spanish lessons for beginners and returning learners.",
    feedUrl: "https://feeds.acast.com/public/shows/985e7c00-8945-4e0d-a4da-b93049180ce1",
    id: "coffee-break-spanish",
    title: "Coffee Break Spanish",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts115/v4/73/01/0a/73010a40-85a8-4d98-1f0d-b25d96b8e86f/mza_11764534205288833014.jpg/100x100bb.jpg",
    author: "Coffee Break Languages",
    categoryId: "language-learning",
    description: "French lessons for learners who want steady practice.",
    feedUrl: "https://feeds.acast.com/public/shows/47990e88-454b-4e3b-bf78-75a172c33184",
    id: "coffee-break-french",
    title: "Coffee Break French",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts123/v4/51/83/1f/51831f65-933b-51ac-215c-6a615706250e/mza_5367088522895403889.jpg/100x100bb.jpg",
    author: "JapanesePod101.com",
    categoryId: "language-learning",
    description: "Japanese audio lessons, vocabulary, and conversation practice.",
    feedUrl: "https://www.japanesepod101.com/wp-feed-audio.php",
    id: "japanesepod101",
    title: "Learn Japanese | JapanesePod101.com",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/68/3f/62/683f6228-b15b-e0de-8c2c-e8c20860ca98/mza_763663699315012405.png/100x100bb.jpg",
    author: "Strict Scrutiny",
    categoryId: "law",
    description: "Supreme Court analysis and legal commentary.",
    feedUrl: "https://audioboom.com/channels/5166629.rss",
    id: "strict-scrutiny",
    title: "Strict Scrutiny",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/e8/52/9b/e8529b7b-21fe-9692-48fd-7696d23a8807/mza_17089514366859568033.jpeg/100x100bb.jpg",
    author: "Slate Podcasts",
    categoryId: "law",
    description: "Law, justice, courts, and constitutional issues.",
    feedUrl: "https://my.slate.com/podcasts/feeds/amicus/",
    id: "amicus",
    title: "Amicus",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/84/85/1a/84851ab4-efa5-7813-6675-8d676660afa8/mza_1680680377268596020.jpg/100x100bb.jpg",
    author: "Opening Arguments Media LLC",
    categoryId: "law",
    description: "Legal explainers, politics, and current court cases.",
    feedUrl: "https://openargs.libsyn.com/",
    id: "opening-arguments",
    title: "Opening Arguments",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts114/v4/ca/d5/c1/cad5c11c-26c6-7e25-afc7-9a496c7f6e03/mza_5631414486129804049.jpeg/100x100bb.jpg",
    author: "Prologue Projects",
    categoryId: "law",
    description: "A critical look at Supreme Court decisions and legal power.",
    feedUrl: "https://feeds.redcircle.com/b6f505a9-f29d-4915-9e94-85182953a0ba",
    id: "five-four",
    title: "5-4",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts116/v4/97/4d/3d/974d3d41-a31f-0f5b-9a76-628009310cda/mza_7057191623385073970.jpg/100x100bb.jpg",
    author: "NEJM Group",
    categoryId: "medicine",
    description: "Medical research summaries and clinical updates from NEJM.",
    feedUrl: "http://feeds.feedburner.com/nejm-this-week-audio-summaries",
    id: "nejm-this-week",
    title: "NEJM This Week",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts115/v4/79/b6/85/79b68546-564f-d6d9-93e6-d9574daaec0f/mza_10829031461214547384.png/100x100bb.jpg",
    author: "JAMA Network",
    categoryId: "medicine",
    description: "Clinical medicine reviews and physician-focused discussions.",
    feedUrl: "https://rss.libsyn.com/shows/67329/destinations/274040.xml",
    id: "jama-clinical-reviews",
    title: "JAMA Clinical Reviews",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts124/v4/67/a3/c1/67a3c113-5d9f-a445-1b9b-80d0fd869d3b/mza_15213153371716337046.jpg/100x100bb.jpg",
    author: "The Curbsiders",
    categoryId: "medicine",
    description: "Internal medicine teaching, clinical reasoning, and expert interviews.",
    feedUrl: "https://audioboom.com/channels/5034728.rss",
    id: "the-curbsiders",
    title: "The Curbsiders Internal Medicine Podcast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts126/v4/e8/a3/0f/e8a30fd2-a4ca-c11e-3423-85e0bc62768e/mza_10043643818402153285.png/100x100bb.jpg",
    author: "The Clinical Problem Solvers",
    categoryId: "medicine",
    description: "Clinical reasoning, diagnostic thinking, and medicine education.",
    feedUrl: "https://clinicalproblemsolving.com/category/episodes/feed/",
    id: "clinical-problem-solvers",
    title: "The Clinical Problem Solvers",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts116/v4/12/9d/e6/129de6c3-8048-078a-e054-751af12fdcd1/mza_5394175969927495016.jpg/100x100bb.jpg",
    author: "The Planetary Society",
    categoryId: "space",
    description: "Space exploration, astronomy, and planetary science.",
    feedUrl:
      "https://www.omnycontent.com/d/playlist/d95da206-8ee8-4ba5-ba8d-ad1200b4e5a4/cf13d5f5-6040-458d-ab5a-ad200189747d/b75c9f7f-4a63-438e-b506-ad2001897499/podcast.rss",
    id: "planetary-radio",
    title: "Planetary Radio",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Features/v4/dd/dd/ad/ddddad15-13df-6813-7d05-d81e45d88d9e/mza_5442136597615139731.jpg/100x100bb.jpg",
    author: "Fraser Cain and Dr. Pamela Gay",
    categoryId: "space",
    description: "Astronomy explanations and space science conversations.",
    feedUrl: "https://rss.libsyn.com/shows/18112/destinations/11189.xml",
    id: "astronomy-cast",
    title: "Astronomy Cast",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts115/v4/81/29/8c/81298c44-7dd2-5df1-ece0-07d795fed455/mza_9798068700639616523.jpg/100x100bb.jpg",
    author: "Carrie Nugent",
    categoryId: "space",
    description: "Stories about space science, research, and discovery.",
    feedUrl: "https://rss.libsyn.com/shows/67852/destinations/277763.xml",
    id: "spacepod",
    title: "Spacepod",
  },
  {
    artworkUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts115/v4/66/87/03/6687030f-ec0d-2f2a-3cf5-b1fa471cdcdd/mza_5973010977383161569.jpg/100x100bb.jpg",
    author: "David Fourman, Ben Etherington, and Dennis Just",
    categoryId: "space",
    description: "Spaceflight, engineering, missions, and orbital mechanics.",
    feedUrl: "http://feeds.feedburner.com/orbitalpodcast",
    id: "orbital-mechanics",
    title: "The Orbital Mechanics Podcast",
  },
] as const satisfies readonly PodcastDirectoryShowSeed[]
