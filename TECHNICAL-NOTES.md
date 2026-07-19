# Technical notes

People occasionally ask what's actually going on under the hood here, past the product story in `DECISIONS.md`. This is the honest rundown, written the way I'd actually explain it if you asked me in person, not a feature checklist.

## It starts with one seeded random number generator

Every random choice in this tool traces back to a single seeded PRNG, passed explicitly through every function that needs it rather than sitting behind some global random call. That's the entire mechanism behind same seed, same output, every time. Nothing fancy, just discipline about never reaching for ambient randomness anywhere in the codebase.

From there, most of what the generator does is sampling from that one source in different shapes. Unit prices come from a normal distribution around a catalog product's average price, clamped so it can't wander into an unrealistic range. Daily order counts work the same way, once I actually wired up the standard deviation field instead of leaving it dead for a while (that one's in `DECISIONS.md` too). Yes or no decisions, COD versus prepaid, RTO or not, discount or not, are straight Bernoulli rolls. Picking which product goes into a basket is weighted sampling, the same roulette-wheel idea you'd use for weighted random selection anywhere: cumulative weights, one random draw against the sum.

## Time behaves like a decomposed series, even though I didn't set out to build one

The trend system, flat, ramp, decline, with noise layered on top, is structurally the same idea as classical time-series decomposition: a base value, multiplied by a trend curve over normalized time, multiplied by a seasonal factor for weekends and festivals, plus noise. I didn't sit down and think I'm building a decomposition model. I built a weekend multiplier, then festival spikes, then a ramp and decline curve, and only noticed afterward that I'd reinvented trend plus seasonality plus noise by hand, one parameter at a time.

## The compound probability bug is the cleanest textbook moment in the whole thing

This one's genuinely satisfying to explain. An order gets assigned to a new customer two different ways: directly, by rolling the new customer rate, or indirectly, by rolling the repeat purchase probability and failing it. For a while the validation table compared actual output against the raw new customer rate input and showed a large, confusing gap. The fix was writing out the actual probability instead of eyeballing it:

```
effective_new_rate = new_customer_rate + (1 - new_customer_rate) * (1 - repeat_purchase_probability)
```

Probability of going new on the first roll, plus probability of surviving to the second roll and failing it. Once that was written down properly, the bug turned out to be a validator that needed the same formula as the generator, not a generator problem at all.

## The AOV story has the real statistics in it

I already wrote that one up in full in `DECISIONS.md` because it's as much a product story as a technical one, so I won't repeat all of it here. The short technical version: standard deviation punishes outliers far harder than it punishes the mean, so a handful of oversized baskets, produced by a target-sampling approach with a generous tolerance band, were enough to inflate the aggregate variance by more than an order of magnitude while barely moving the average. That's the actual reason the mean looked fine while the standard deviation was wildly off, and it's the kind of thing that's obvious once you know to look for it and invisible if you're just staring at two numbers wondering why they disagree.

The fix for the order volume validation used a related idea, the law of total variance: total variance splits into the average of each day's own noise, plus the variance between the days' targets themselves. The validator was only computing the first half, and missing that weekends and festival spikes swing the targets around a lot more than daily noise does.

## Small stuff that's easy to miss but is still real math

Item count per order comes from a fractional mean, something like 2.3 items, through a form of stochastic rounding: split into a floor and a probability of rounding up, so any single order is a whole number of items but the average across enough orders converges exactly on whatever number was typed in. It's the same trick used in image dithering to represent a shade you can't actually produce with the pixels available.

Every rate in the tool is clamped to a 0 to 1 range, and every discount is clamped below its own order's subtotal. Unglamorous, but this is where most of the real bugs actually lived. An unclamped probability field silently drifting past 100% is what caused one of the uglier debugging sessions in this project.

## If someone asks me about this out loud

The compressed version I'd actually say in an interview: this project is mostly seeded random sampling, normal, Bernoulli, weighted categorical, layered under a hand-rolled trend plus seasonality plus noise model for time, with the two most interesting moments being a compound probability bug that needed the law of total probability to actually explain, and an AOV variance blowup that came down to how much more sensitive standard deviation is to outliers than the mean is, which ended up reshaping the product's inputs, not just the code.
