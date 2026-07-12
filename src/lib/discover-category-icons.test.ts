import { describe, expect, it } from "vitest"

import { getDefaultDiscoverCategoryIconKey } from "./discover-category-icons"

describe("discover category icon defaults", () => {
  it("keeps existing broad topics on their current icons", () => {
    expect(getDefaultDiscoverCategoryIconKey("opml-gaming", "Gaming")).toBe(
      "gaming"
    )
    expect(getDefaultDiscoverCategoryIconKey("opml-science", "Science")).toBe(
      "science"
    )
    expect(getDefaultDiscoverCategoryIconKey("opml-ai", "AI")).toBe("ai")
    expect(getDefaultDiscoverCategoryIconKey("opml-sports", "Sports")).toBe(
      "sports"
    )
    expect(getDefaultDiscoverCategoryIconKey("opml-tech", "Tech")).toBe("tech")
    expect(getDefaultDiscoverCategoryIconKey("reddit", "Reddit")).toBe(
      "reddit"
    )
    expect(
      getDefaultDiscoverCategoryIconKey(
        "opml-business-and-economy",
        "Business & Economy"
      )
    ).toBe("business")
    expect(getDefaultDiscoverCategoryIconKey("opml-news", "News")).toBe(
      "general"
    )
  })

  it("maps imported topic names to specific icon keys", () => {
    expect(
      getDefaultDiscoverCategoryIconKey("opml-android", "Android (cell phone)")
    ).toBe("android")
    expect(
      getDefaultDiscoverCategoryIconKey(
        "opml-android-develpment",
        "Android Develpment"
      )
    ).toBe("android-development")
    expect(
      getDefaultDiscoverCategoryIconKey("opml-apple-company", "Apple (company)")
    ).toBe("apple")
    expect(
      getDefaultDiscoverCategoryIconKey("opml-architecture", "Architecture")
    ).toBe("architecture")
    expect(getDefaultDiscoverCategoryIconKey("opml-beauty", "Beauty")).toBe(
      "beauty"
    )
    expect(getDefaultDiscoverCategoryIconKey("opml-books", "Books")).toBe(
      "books"
    )
    expect(getDefaultDiscoverCategoryIconKey("opml-cars", "Cars")).toBe("cars")
    expect(
      getDefaultDiscoverCategoryIconKey("opml-marketing", "Marketing")
    ).toBe("marketing")
    expect(getDefaultDiscoverCategoryIconKey("opml-comics", "Comics")).toBe(
      "comics"
    )
    expect(getDefaultDiscoverCategoryIconKey("opml-design", "Design")).toBe(
      "design"
    )
    expect(
      getDefaultDiscoverCategoryIconKey("opml-torrenting", "Torrenting")
    ).toBe("torrenting")
    expect(
      getDefaultDiscoverCategoryIconKey("opml-bittorrent", "BitTorrent")
    ).toBe("torrenting")
    expect(
      getDefaultDiscoverCategoryIconKey("opml-advertising", "Advertising")
    ).toBe("advertising")
    expect(
      getDefaultDiscoverCategoryIconKey("opml-ad-tech", "Ad Tech")
    ).toBe("advertising")
    expect(
      getDefaultDiscoverCategoryIconKey("opml-biopharma", "Biopharma")
    ).toBe("biopharma")
    expect(
      getDefaultDiscoverCategoryIconKey("opml-cybersecurity", "Cybersecurity")
    ).toBe("cybersecurity")
    expect(getDefaultDiscoverCategoryIconKey("opml-energy", "Energy")).toBe(
      "energy"
    )
    expect(
      getDefaultDiscoverCategoryIconKey("opml-healthcare", "Healthcare")
    ).toBe("healthcare")
    expect(
      getDefaultDiscoverCategoryIconKey("opml-real-estate", "Real Estate")
    ).toBe("real-estate")
    expect(getDefaultDiscoverCategoryIconKey("opml-retail", "Retail")).toBe(
      "retail"
    )
    expect(
      getDefaultDiscoverCategoryIconKey(
        "opml-travel-hospitality",
        "Travel & Hospitality"
      )
    ).toBe("travel-hospitality")
    expect(
      getDefaultDiscoverCategoryIconKey(
        "opml-artificial-intelligence",
        "Artificial Intelligence"
      )
    ).toBe("ai")
    expect(
      getDefaultDiscoverCategoryIconKey(
        "opml-machine-learning",
        "Machine Learning"
      )
    ).toBe("ai")
    expect(getDefaultDiscoverCategoryIconKey("opml-cricket", "Cricket")).toBe(
      "cricket"
    )
    expect(
      getDefaultDiscoverCategoryIconKey("opml-interior-design", "Interior Design")
    ).toBe("interior-design")
    expect(getDefaultDiscoverCategoryIconKey("opml-diy", "DIY")).toBe("diy")
    expect(getDefaultDiscoverCategoryIconKey("opml-fasion", "Fasion")).toBe(
      "fashion"
    )
    expect(getDefaultDiscoverCategoryIconKey("opml-food", "Food")).toBe("food")
    expect(
      getDefaultDiscoverCategoryIconKey("opml-football", "Football")
    ).toBe("football")
    expect(getDefaultDiscoverCategoryIconKey("opml-funny", "Funny")).toBe(
      "funny"
    )
    expect(getDefaultDiscoverCategoryIconKey("opml-history", "History")).toBe(
      "history"
    )
    expect(
      getDefaultDiscoverCategoryIconKey(
        "opml-ios-development",
        "iOS Development"
      )
    ).toBe("ios-development")
    expect(getDefaultDiscoverCategoryIconKey("opml-movies", "Movies")).toBe(
      "movies"
    )
    expect(getDefaultDiscoverCategoryIconKey("opml-music", "Music")).toBe(
      "music"
    )
    expect(
      getDefaultDiscoverCategoryIconKey(
        "opml-personal-finance",
        "Personal Finance"
      )
    ).toBe("personal-finance")
    expect(
      getDefaultDiscoverCategoryIconKey("opml-photography", "Photography")
    ).toBe("photography")
    expect(
      getDefaultDiscoverCategoryIconKey("opml-programming", "Programming")
    ).toBe("programming")
    expect(getDefaultDiscoverCategoryIconKey("opml-space", "Space")).toBe(
      "space"
    )
    expect(
      getDefaultDiscoverCategoryIconKey("opml-startups", "Startups")
    ).toBe("startups")
    expect(
      getDefaultDiscoverCategoryIconKey("opml-television", "Television")
    ).toBe("television")
    expect(getDefaultDiscoverCategoryIconKey("opml-tennis", "Tennis")).toBe(
      "tennis"
    )
    expect(getDefaultDiscoverCategoryIconKey("opml-travel", "Travel")).toBe(
      "travel"
    )
    expect(
      getDefaultDiscoverCategoryIconKey(
        "opml-entrepreneurship",
        "Entrepreneurship"
      )
    ).toBe("startups")
    expect(
      getDefaultDiscoverCategoryIconKey("opml-leadership", "Leadership")
    ).toBe("business")
    expect(
      getDefaultDiscoverCategoryIconKey("opml-economics", "Economics")
    ).toBe("business")
    expect(getDefaultDiscoverCategoryIconKey("opml-seo", "SEO")).toBe(
      "marketing"
    )
    expect(
      getDefaultDiscoverCategoryIconKey("opml-management", "Management")
    ).toBe("business")
    expect(
      getDefaultDiscoverCategoryIconKey("opml-data-science", "Data Science")
    ).toBe("science")
    expect(getDefaultDiscoverCategoryIconKey("opml-writing", "Writing")).toBe(
      "books"
    )
    expect(
      getDefaultDiscoverCategoryIconKey("opml-creativity", "Creativity")
    ).toBe("design")
    expect(
      getDefaultDiscoverCategoryIconKey(
        "opml-content-marketing",
        "Content Marketing"
      )
    ).toBe("marketing")
    expect(getDefaultDiscoverCategoryIconKey("opml-culture", "Culture")).toBe(
      "entertainment"
    )
    expect(getDefaultDiscoverCategoryIconKey("opml-crafts", "Crafts")).toBe(
      "diy"
    )
    expect(
      getDefaultDiscoverCategoryIconKey("opml-paranormal", "Paranormal")
    ).toBe("paranormal")
    expect(getDefaultDiscoverCategoryIconKey("opml-ghosts", "Ghosts")).toBe(
      "paranormal"
    )
    expect(getDefaultDiscoverCategoryIconKey("opml-aliens", "Aliens")).toBe(
      "aliens"
    )
    expect(getDefaultDiscoverCategoryIconKey("opml-uap", "UAP")).toBe("aliens")
    expect(getDefaultDiscoverCategoryIconKey("opml-ui-ux", "UI / UX")).toBe(
      "ui-ux"
    )
    expect(
      getDefaultDiscoverCategoryIconKey("opml-web-development", "Web Development")
    ).toBe("web-development")
  })
})
