# Design decisions

Not every decision here was clean the first time. A few took three or four passes before the actual problem became clear, and I'd rather leave that visible than tidy it up into something that reads like I saw it coming from the start. This is roughly the order it happened in.

## Products only come from your upload, never built in

First version of this shipped with six hardcoded, fully branded catalogs, one per store scenario, so clicking a scenario generated orders for a fictional wellness brand's actual products. Fine for the one internal use case this started as. Wrong for an open source tool. Nobody should get orders for a made-up company baked into a generic generator, and a catalog nobody can swap out isn't testing anything real about their own store.

Deleted all six. Catalog upload went from optional to required. There's no fallback path now, try to generate with nothing uploaded and the tool just tells you to upload something.

Scenario presets survived this, but got stripped down to pure behavior: order volume, COD rate, discount pattern, that kind of thing. No product data, no brand name on the card, just a description of the shape of demand. Clicking one fills in the parameter boxes and nothing else.

## Timeline overrides change specific parameters, they don't replace the whole config

Got this one right on paper before building it, mostly because I'd already made the opposite call somewhere else in the project and didn't want to repeat the mistake.

The paste box lets you override behavior for a date range: a festival spike, a slow month. Question was whether a pasted row should be a full parameter set for that window, with anything unspecified defaulting to zero, or a partial patch, with anything unspecified still reading from the base settings above.

Went with the patch model. A festival-spike row might only touch four of the thirteen fields. The other nine keep coming from whatever's in the boxes above, for that window and every other one. The alternative meant restating all thirteen values every time you wanted to bump discount rate for two weeks, which kills the whole point of having a sparse override system.

## Average order value took three tries, and the third try wasn't a fix, it was admitting the input was wrong

This is the one worth reading if you only read one.

**Round one.** AOV mean and AOV std were direct input boxes. Generation capped unit prices near the target and resampled baskets that overshot it. Worked fine against the original hardcoded catalogs. Broke the moment catalog upload shipped, because now someone could upload a catalog whose real prices had nothing to do with whatever AOV number they'd typed in. One preset's target was 849. A real uploaded catalog with prices ranging roughly 249 to 899 produced datasets averaging 615 instead. Not really a bug, the cap just can't pull an average up when the whole catalog sits below it.

**Round two.** Rebuilt basket construction to actively sample toward a target instead of capping and rejecting. That fixed the mean. Then a probability field wired in the same round, repeat purchase probability, turned out to be uncapped and was hitting numbers over 100% on some days because of unclamped trend noise. Separately, new customer rate was showing a large gap between expected and actual because the comparison math hadn't been updated for a two-stage assignment rule I'd built into generation.

**Round three.** Fixed both of those. AOV mean landed close to target. AOV std did not, it came in at something like sixteen times the input value. Spent a while suspecting the trend logic on std itself was spiking on certain days. It wasn't, logged every day's value and they all sat within a few points of the base number. The real issue: a single sampled per-order target, drawn generously across a wide range, plus a fifteen percent overshoot allowance, could occasionally produce a basket several times the target value, and because standard deviation punishes outliers far harder than it punishes the mean, a handful of those orders were enough to blow the aggregate variance up by an order of magnitude while barely moving the average.

Sat with that instead of patching the tolerance band a fourth time, and asked a more basic question: should AOV be an input at all. A merchant doesn't set their average order value directly, it's a consequence of what they sell and how people shop, not a dial. Every round above had been trying to force an output to behave like an input, and every fix addressed whatever symptom had shown up that week.

Replaced `aov_mean` and `aov_std` with two things that actually are independent of any catalog: how many distinct products typically end up in a basket, and how often a line item gets bought as quantity two instead of one. AOV is now computed from those two plus whatever catalog is uploaded, shown live as an estimate, never typed in directly. Basket construction went back to being simple again, pick items, pick quantities, sum it up, because nothing is straining toward an externally set number anymore.

Three rounds to get here, and I'm leaving all three in this file instead of writing it up as if I'd seen the real answer from the start.

## Every generated dataset checks its own homework

Getting the fix above right meant generating a dataset, opening it, computing several averages by hand, and eyeballing whether the numbers looked right, every single round. That doesn't scale, and it's a bad experience for anyone else using this with their own catalog and parameters. They shouldn't have to do that math themselves just to trust the output.

So the generator now records what it actually targeted, per day, while it runs, and a comparison table ships alongside every generated dataset: expected values from your inputs against the actual measured values from the output, computed from those recorded per-day targets rather than a separate re-simulation. This is the thing that caught the repeat-purchase-probability bug and the AOV variance blowup in the first place. Would not have found either one by staring at a JSON file.
