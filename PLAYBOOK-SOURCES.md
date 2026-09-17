# Competitor price sources by UK trade

Generated 2026-09-16 from web/tools/sources/uk-directories.ts. Do not edit by
hand: run `npm run playbook-sources`.

**For checking by someone who did not build this.** Every source was fetched
before it was written down. "Readable" means its robots.txt returned a real
response to our reader; it does not mean a listing page has been read, which is
a separate and harder claim we have only made for Booksy, Fresha and the Food
Standards Agency.

A source covers the trades it actually lists. Where it covers a whole group,
the group is named and the reason is in the code, because tagging by group is
what once had a dog-walking site covering vets.

- Trades: **100**
- Price comparison possible: **17**
- Not possible: **83**
- Trades with a specialist source: **65** (the rest have the general floor only)
- Sources: **59** (33 readable, 12 blocked, 14 untested)

## Where no public prices exist

Confirmed by three independent research passes. In each case the reason is how
the trade prices its work, not a gap in our searching.

| Group | Why |
|---|---|
| home-services | Every UK trade directory works on quote for the job. Checkatrade, MyBuilder, Rated People, TrustATrader and Bark all publish names, ratings and review counts, and none publishes a rate or a call-out fee. 26 trades, the largest group we have. Removals is the one exception: Compare My Move and reallymoving quote it, because a move is a priceable job and a leaking pipe is not. |
| pets | Nothing for any of our three. Dog walking and sitting have marketplace prices on BorrowMyDoggy and Gudog, but walking is not a trade we offer: ours are vet, pet-groomer and kennels. Veterinary treatment is priced after a consultation, and no UK directory indexes kennel rates. |
| healthcare | No UK marketplace aggregates independent physios, chiropractors or opticians with treatment prices. Chains publish their own fee cards; independents do not. |
| dental | Same as healthcare. CQC and NHS carry names and inspections, never fees. |
| property | Rightmove and OnTheMarket list properties, not agents' fees. Agency commission is negotiated and unpublished. |

## Every trade

| Trade | Group | Prices? | Price sources | Other sources |
|---|---|---|---|---|
| accountancy | professional | no | — | Unbiased, VouchedFor |
| accountant | professional | no | — | Unbiased, VouchedFor |
| aesthetics | hair-and-beauty | **yes** | Booksy, Fresha, Treatwell | — |
| arborist | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| architect | professional | no | — | — |
| architectural | professional | no | — | — |
| bakery | food-and-drink | **yes** | Deliveroo | Food Standards Agency |
| barber | hair-and-beauty | **yes** | Booksy, Fresha, Treatwell | — |
| barbers | hair-and-beauty | **yes** | Booksy, Fresha, Treatwell | — |
| barbershop | hair-and-beauty | **yes** | Booksy, Fresha, Treatwell | — |
| beautician | hair-and-beauty | **yes** | Booksy, Fresha, Treatwell | — |
| beauty-salon | hair-and-beauty | **yes** | Booksy, Fresha, Treatwell | — |
| bistro | food-and-drink | **yes** | DesignMyNight, TheFork, ResDiary | Food Standards Agency |
| boutique | retail-and-events | no | — | — |
| branding | professional | no | — | Creativepool |
| builder | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| cafe | food-and-drink | **yes** | Deliveroo | Food Standards Agency |
| car-sales | automotive | **yes** | AutoTrader UK | — |
| car-valet | automotive | no | — | — |
| carpenter | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| caterer | food-and-drink | **yes** | Poptop, Add to Event | Food Standards Agency |
| childcare | education | no | — | Daynurseries, Childcare.co.uk |
| childminder | education | no | — | Daynurseries, Childcare.co.uk |
| chiropractor | healthcare | no | — | Doctify, Care Quality Commission, NHS service search |
| cleaner | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| construction | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| consultant | professional | no | — | — |
| convenience | retail-and-events | no | — | — |
| conveyancer | legal | **yes** | Compare My Move, reallymoving, The Law Superstore | The Law Society, Solicitors Regulation Authority |
| counselling | professional | **yes** | Psychology Today | — |
| dealership | automotive | **yes** | AutoTrader UK | — |
| decorator | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| dentist | dental | no | — | Care Quality Commission, NHS service search |
| driving-instructor | education | no | — | — |
| eatery | food-and-drink | **yes** | DesignMyNight, TheFork, ResDiary | Food Standards Agency |
| electrician | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| estate-agent | property | no | — | Rightmove, OnTheMarket |
| events | retail-and-events | **yes** | Poptop, Add to Event, DesignMyNight, Eventbrite, Tagvenue | — |
| flooring | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| florist | retail-and-events | **yes** | Direct2Florist | — |
| garage | automotive | **yes** | WhoCanFixMyCar, Servicing Stop | RAC Approved Garages |
| glazier | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| gym | fitness | **yes** | ClassPass, Mindbody, Hussle | — |
| hairdresser | hair-and-beauty | **yes** | Booksy, Fresha, Treatwell | — |
| handyman | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| it-support | professional | no | — | — |
| joinery | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| kebab | food-and-drink | **yes** | Deliveroo | Food Standards Agency |
| kennels | pets | no | — | — |
| landscaper | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| lettings | property | no | — | Rightmove, OnTheMarket |
| locksmith | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| manicurist | hair-and-beauty | **yes** | Booksy, Fresha, Treatwell | — |
| marketing-agency | professional | no | — | Creativepool |
| massage-spa | wellness | **yes** | Booksy, Fresha, Treatwell | — |
| masseuse | wellness | **yes** | Booksy, Fresha, Treatwell | — |
| mortgage-broker | professional | no | — | Unbiased, VouchedFor |
| nail-salon | hair-and-beauty | **yes** | Booksy, Fresha, Treatwell | — |
| optician | healthcare | no | — | Doctify, Care Quality Commission, NHS service search |
| optometrist | healthcare | no | — | Doctify, Care Quality Commission, NHS service search |
| orthodontist | dental | no | — | Care Quality Commission, NHS service search |
| osteopathy | healthcare | no | — | Doctify, Care Quality Commission, NHS service search |
| painter-decorator | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| personal-trainer | fitness | **yes** | ClassPass, Mindbody, Hussle | — |
| pest-control | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| pet-groomer | pets | no | — | — |
| photographer | retail-and-events | **yes** | Poptop, Add to Event | — |
| physio | healthcare | no | — | Doctify, Care Quality Commission, NHS service search |
| physiotherapy | healthcare | no | — | Doctify, Care Quality Commission, NHS service search |
| pilates | fitness | **yes** | ClassPass, Mindbody, Hussle | — |
| pizza | food-and-drink | **yes** | Deliveroo | Food Standards Agency |
| plasterer | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| plastering | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| plumber | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| plumbing | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| pre-school | education | no | — | Daynurseries, Childcare.co.uk |
| psychotherapist | professional | **yes** | Psychology Today | — |
| pub-bar | food-and-drink | **yes** | DesignMyNight, TheFork, ResDiary | Food Standards Agency |
| recruiter | professional | no | — | — |
| removals | home-services | **yes** | Compare My Move, reallymoving | Rated People, TrustATrader, MyBuilder |
| rendering | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| restaurant | food-and-drink | **yes** | Deliveroo, DesignMyNight, TheFork, ResDiary | Food Standards Agency |
| roofer | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| roofing | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| servicing | automotive | **yes** | WhoCanFixMyCar, Servicing Stop | RAC Approved Garages |
| shop | retail-and-events | no | — | — |
| solicitor | legal | **yes** | Compare My Move, reallymoving, The Law Superstore | The Law Society, Solicitors Regulation Authority |
| staffing | professional | no | — | — |
| store | retail-and-events | no | — | — |
| stylist | hair-and-beauty | **yes** | Booksy, Fresha, Treatwell | — |
| takeaway | food-and-drink | **yes** | Deliveroo | Food Standards Agency |
| tattoo-studio | hair-and-beauty | **yes** | Booksy, Fresha, Treatwell | — |
| tattooist | hair-and-beauty | **yes** | Booksy, Fresha, Treatwell | — |
| therapist | professional | **yes** | Psychology Today | — |
| tiler | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| tree-surgeon | home-services | no | — | Rated People, TrustATrader, MyBuilder |
| tuition | education | **yes** | Tutorful, ClassForKids | — |
| tutor | education | **yes** | Tutorful, ClassForKids | — |
| vet | pets | no | — | — |
| window-doors | home-services | no | — | Rated People, TrustATrader, MyBuilder |

## Every source

| Source | Host | Reachable | Carries | Trades claimed | Claim came from |
|---|---|---|---|---|---|
| Yell | yell.com | blocked (Cloudflare challenge on robots.txt) | names, ratings, reviewCount | every trade | birdeye.com/blog/local-business-directories-uk/ — UK directories by industry, read 2026-09-16 |
| Thomson Local | thomsonlocal.com | blocked (Returns 'You are blocked') | names, ratings | every trade | birdeye.com/blog/local-business-directories-uk/ — UK directories by industry, read 2026-09-16 |
| Cylex UK | cylex-uk.co.uk | blocked (Cloudflare challenge on robots.txt) | names | every trade | birdeye.com/blog/local-business-directories-uk/ — UK directories by industry, read 2026-09-16 |
| FreeIndex | freeindex.co.uk | readable, 2026-09-16 | names, ratings, reviewCount | every trade | birdeye.com/blog/local-business-directories-uk/ — UK directories by industry, read 2026-09-16 |
| Bark | bark.com | untested | names, ratings, reviewCount | every trade | birdeye.com/blog/local-business-directories-uk/ — UK directories by industry, read 2026-09-16 |
| Trustpilot UK | uk.trustpilot.com | untested | names, ratings, reviewCount | every trade | birdeye.com/blog/local-business-directories-uk/ — UK directories by industry, read 2026-09-16 |
| Checkatrade | checkatrade.com | blocked (403 to our reader, seen on a run) | names, ratings, reviewCount | 26 | birdeye.com/blog/local-business-directories-uk/ — UK directories by industry, read 2026-09-16 |
| Rated People | ratedpeople.com | untested | names, ratings, reviewCount | 26 | birdeye.com/blog/local-business-directories-uk/ — UK directories by industry, read 2026-09-16 |
| TrustATrader | trustatrader.com | untested | names, ratings, reviewCount | 26 | birdeye.com/blog/local-business-directories-uk/ — UK directories by industry, read 2026-09-16 |
| Booksy | booksy.com | readable, 2026-09-16 | names, ratings, reviewCount, prices, services | 14 | Our own runs |
| Fresha | fresha.com | readable, 2026-09-16 | names, ratings, reviewCount, prices, services | 14 | birdeye.com/blog/local-business-directories-uk/ — UK directories by industry, read 2026-09-16 |
| Treatwell | treatwell.co.uk | untested | names, ratings, reviewCount, prices, services | 14 | birdeye.com/blog/local-business-directories-uk/ — UK directories by industry, read 2026-09-16 |
| AutoTrader UK | autotrader.co.uk | untested | names, prices | 2 | birdeye.com/blog/local-business-directories-uk/ — UK directories by industry, read 2026-09-16 |
| RAC Approved Garages | rac.co.uk | untested | names, ratings | 2 | birdeye.com/blog/local-business-directories-uk/ — UK directories by industry, read 2026-09-16 |
| Doctify | doctify.com | untested | names, ratings, reviewCount | 6 | birdeye.com/blog/local-business-directories-uk/ — UK directories by industry, read 2026-09-16 |
| Care Quality Commission | cqc.org.uk | untested | names | 8 | birdeye.com/blog/local-business-directories-uk/ — UK directories by industry, read 2026-09-16 |
| NHS service search | nhs.uk | untested | names, ratings | 8 | birdeye.com/blog/local-business-directories-uk/ — UK directories by industry, read 2026-09-16 |
| The Law Society | solicitors.lawsociety.org.uk | untested | names, services | 2 | birdeye.com/blog/local-business-directories-uk/ — UK directories by industry, read 2026-09-16 |
| Solicitors Regulation Authority | solicitors.sra.org.uk | untested | names | 2 | birdeye.com/blog/local-business-directories-uk/ — UK directories by industry, read 2026-09-16 |
| Rightmove | rightmove.co.uk | untested | names | 2 | birdeye.com/blog/local-business-directories-uk/ — UK directories by industry, read 2026-09-16 |
| OnTheMarket | onthemarket.com | untested | names | 2 | birdeye.com/blog/local-business-directories-uk/ — UK directories by industry, read 2026-09-16 |
| WhoCanFixMyCar | whocanfixmycar.com | readable, 2026-09-16 | names, ratings, reviewCount, prices, services | 2 | Gemini research pass, 2026-09-16, each name then tested by us before it was added |
| Servicing Stop | servicingstop.co.uk | readable, 2026-09-16 | names, prices, services | 2 | Gemini research pass, 2026-09-16, each name then tested by us before it was added |
| BookMyGarage | bookmygarage.com | blocked (429 on robots.txt) | names, ratings, prices | 2 | Gemini research pass, 2026-09-16, each name then tested by us before it was added |
| Compare My Move | comparemymove.com | readable, 2026-09-16 | names, ratings, reviewCount, prices | 3 | Gemini research pass, 2026-09-16, each name then tested by us before it was added |
| reallymoving | reallymoving.com | readable, 2026-09-16 | names, ratings, prices | 3 | Gemini research pass, 2026-09-16, each name then tested by us before it was added |
| The Law Superstore | thelawsuperstore.co.uk | readable, 2026-09-16 | names, ratings, prices | 2 | Gemini research pass, 2026-09-16, each name then tested by us before it was added |
| Direct2Florist | direct2florist.co.uk | readable, 2026-09-16 | names, ratings, reviewCount, prices | 1 | Gemini research pass, 2026-09-16, each name then tested by us before it was added |
| Poptop | poptop.uk.com | readable, 2026-09-16 | names, ratings, reviewCount, prices | 3 | Gemini research pass, 2026-09-16, each name then tested by us before it was added |
| Add to Event | addtoevent.co.uk | readable, 2026-09-16 | names, ratings, reviewCount, prices | 3 | Gemini research pass, 2026-09-16, each name then tested by us before it was added |
| Daynurseries | daynurseries.co.uk | readable, 2026-09-16 | names, ratings, reviewCount | 3 | Gemini research pass, 2026-09-16, each name then tested by us before it was added |
| Childcare.co.uk | childcare.co.uk | readable, 2026-09-16 | names, ratings, reviewCount | 3 | Gemini research pass, 2026-09-16, each name then tested by us before it was added |
| Unbiased | unbiased.co.uk | readable, 2026-09-16 | names, ratings, reviewCount | 3 | Gemini research pass, 2026-09-16, each name then tested by us before it was added |
| VouchedFor | vouchedfor.co.uk | readable, 2026-09-16 | names, ratings, reviewCount | 3 | Gemini research pass, 2026-09-16, each name then tested by us before it was added |
| Creativepool | creativepool.com | readable, 2026-09-16 | names | 2 | Gemini research pass, 2026-09-16, each name then tested by us before it was added |
| Clutch | clutch.co | blocked (403 on robots.txt) | names, ratings, reviewCount | 6 | Gemini research pass, 2026-09-16, each name then tested by us before it was added |
| MyBuilder | mybuilder.com | readable, 2026-09-16 | names, ratings, reviewCount | 26 | Gemini research pass, 2026-09-16, each name then tested by us before it was added |
| Deliveroo | deliveroo.co.uk | readable, 2026-09-16 | names, ratings, reviewCount, prices, services | 6 | ChatGPT research pass, 2026-09-16, each name then tested by us |
| DesignMyNight | designmynight.com | readable, 2026-09-16 | names, ratings, reviewCount, prices | 5 | ChatGPT research pass, 2026-09-16, each name then tested by us |
| TheFork | thefork.co.uk | readable, 2026-09-16 | names, ratings, reviewCount, prices | 4 | ChatGPT research pass, 2026-09-16, each name then tested by us |
| ResDiary | resdiary.com | readable, 2026-09-16 | names, prices | 4 | ChatGPT research pass, 2026-09-16, each name then tested by us |
| Food Standards Agency | api.ratings.food.gov.uk | readable, 2026-09-16 | names | 10 | Our own runs |
| Tutorful | tutorful.co.uk | readable, 2026-09-16 | names, ratings, reviewCount, prices | 2 | ChatGPT research pass, 2026-09-16, each name then tested by us |
| ClassForKids | classforkids.co.uk | readable, 2026-09-16 | names, prices | 2 | ChatGPT research pass, 2026-09-16, each name then tested by us |
| ClassPass | classpass.com | readable, 2026-09-16 | names, ratings, reviewCount, prices, services | 3 | ChatGPT research pass, 2026-09-16, each name then tested by us |
| Mindbody | mindbody.io | readable, 2026-09-16 | names, ratings, prices, services | 3 | ChatGPT research pass, 2026-09-16, each name then tested by us |
| Hussle | hussle.com | readable, 2026-09-16 | names, ratings, reviewCount, prices | 3 | ChatGPT research pass, 2026-09-16, each name then tested by us |
| BorrowMyDoggy | borrowmydoggy.com | readable, 2026-09-16 | names, prices | 0 | ChatGPT research pass, 2026-09-16, each name then tested by us |
| Gudog | gudog.co.uk | readable, 2026-09-16 | names, ratings, reviewCount, prices | 0 | ChatGPT research pass, 2026-09-16, each name then tested by us |
| Pets4Homes | pets4homes.co.uk | readable, 2026-09-16 | names | 0 | Gemini research pass, 2026-09-16, each name then tested by us before it was added |
| Psychology Today | psychologytoday.com | readable, 2026-09-16 | names, prices | 3 | ChatGPT research pass, 2026-09-16, each name then tested by us |
| Eventbrite | eventbrite.co.uk | readable, 2026-09-16 | names, prices | 1 | ChatGPT research pass, 2026-09-16, each name then tested by us |
| Tagvenue | tagvenue.com | readable, 2026-09-16 | names, ratings, reviewCount, prices | 1 | ChatGPT research pass, 2026-09-16, each name then tested by us |
| Just Eat | just-eat.co.uk | blocked (403 on robots.txt) | names, ratings, reviewCount, prices | 6 | ChatGPT research pass, 2026-09-16, each name then tested by us |
| Uber Eats | ubereats.com | blocked (403 on robots.txt) | names, ratings, prices | 6 | ChatGPT research pass, 2026-09-16, each name then tested by us |
| Rover | rover.com | blocked (403 on robots.txt) | names, ratings, reviewCount, prices | 0 | ChatGPT research pass, 2026-09-16, each name then tested by us |
| Superprof | superprof.co.uk | blocked (403 on robots.txt) | names, ratings, prices | 2 | ChatGPT research pass, 2026-09-16, each name then tested by us |
| Fever | fever.com | blocked (403 on robots.txt) | names, prices | 1 | ChatGPT research pass, 2026-09-16, each name then tested by us |
| Zoopla | zoopla.co.uk | blocked (403 on robots.txt) | names | 2 | birdeye.com/blog/local-business-directories-uk/ — UK directories by industry, read 2026-09-16 |

## How to check this

1. **A source we call readable**: fetch `https://<host>/robots.txt` and see if
   a real file comes back rather than a challenge page.
2. **A source we call blocked**: the same, and expect the failure named.
3. **A price claim**: open the source's own listing page for a trade and town and
   look for a price beside a business name. If there is none, the row is wrong.
4. **A trade claim**: open the source and search for that trade. A source listed
   against a trade it does not carry is the failure this report had on its first
   publication.
5. **A "no prices exist" claim**: the strongest claim here and the one most worth
   attacking. One UK site publishing plumber rates by town disproves it.
