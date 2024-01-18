# ProTI RWW Demo

This repo demonstrates the [ProTI](https://proti-iac.github.io) automated testing tool on the Random Word Webpage (RWW). RWW is a simple static website deployed in an AWS S3 bucket, displaying a word randomly selected from an array. [`index.ts`](index.ts) implements its deployment in Pulumi TypeScript, which, unfortunately, has a bug that we are going to find with ProTI.

You can watch the demonstration on YouTube by clicking on this image and experience it by following along or continuing to read this tutorial.

[<img src="https://i.ytimg.com/vi/e-FlGcOs8PI/maxresdefault.jpg" width="100%">](https://www.youtube.com/watch?v=e-FlGcOs8PI "Demonstration Recording on YouTube")

## Setup

To follow this demo, you require an installation of NodeJS with NPM and Pulumi. If you want to run the deployment – not only test it with ProTI – you also need the AWS CLI and be logged into an AWS account with permission to manage the used S3 resources. We used and verified this demo with NodeJS 18.16.0, NPM 9.5.1, Pulumi 3.101.1, and AWS CLI 2.15.3, but more recent versions should work, too.

Install the dependencies running:

```
npm install
```

## ProTI Setup

The project is already configured for ProTI (version: `1.1.1`), as documented [here](https://proti-iac.github.io/#getting-started) and [here](https://github.com/proti-iac/proti/blob/main/proti-pulumi-packages-schema/README.md). `jest`, `ts-jest`, `@proti-iac/runner`, `@proti-iac/test-runner`, `@proti-iac/spec`, and `@proti-iac/pulumi-packages-schema` and the transitive dependencies are installed as development dependencies of this project. [`jest.config.js`](jest.config.js) configures ProTI in Jest with type-based generator and oracle plugins.

## Follow-along Demo

### 1. The Problem

You can deploy and undeploy RWW by running `pulumi up` and `pulumi destroy`. However, if you try it a couple of times, you will sometimes observe an error like:

```
    TypeError: Cannot read properties of undefined (reading 'toUpperCase')
        at /Users/daniel/Development/proti-rww-demo/index.ts:16:44
        at /Users/daniel/Development/proti-rww-demo/node_modules/@pulumi/output.ts:404:31
        at Generator.next (<anonymous>)
        at /Users/daniel/Development/proti-rww-demo/node_modules/@pulumi/pulumi/output.js:21:71
        at new Promise (<anonymous>)
        at __awaiter (/Users/daniel/Development/proti-rww-demo/node_modules/@pulumi/pulumi/output.js:17:12)
        at applyHelperAsync (/Users/daniel/Development/proti-rww-demo/node_modules/@pulumi/pulumi/output.js:245:12)
        at /Users/daniel/Development/proti-rww-demo/node_modules/@pulumi/output.ts:316:13
        at processTicksAndRejections (node:internal/process/task_queues:95:5)
```

There is an index out-of-bound access in line 16 because the random number 3 is drawn, which is possible because `rng` in line 10 is configured to draw a random number from 0 to `words.length` (3) (see `rngRange` in line 9). Correct would be from 0 to `words.length - 1`.

### 2. Finding the Bug with ProTI

Run ProTI:

```
npx jest
```

You should see that the tests failed and an error message, showing that ProTI also finds this bug:

```
################################################################################
# 🐞 0: Check program (run 1)

TypeError: Cannot read properties of undefined (reading 'toUpperCase')
    at /Users/daniel/Development/proti-rww-demo/index.ts:18:32
    at /Users/daniel/Development/proti-rww-demo/node_modules/@pulumi/output.ts:404:31
    at Generator.next (<anonymous>)
    at /Users/daniel/Development/proti-rww-demo/node_modules/@pulumi/pulumi/output.js:21:71
    at new Promise (<anonymous>)
    at Object.<anonymous>.__awaiter (/Users/daniel/Development/proti-rww-demo/node_modules/@pulumi/pulumi/output.js:17:12)
    at applyHelperAsync (/Users/daniel/Development/proti-rww-demo/node_modules/@pulumi/pulumi/output.js:245:12)
    at /Users/daniel/Development/proti-rww-demo/node_modules/@pulumi/output.ts:316:13
```

### 3. Fix the Program

Replace `words.length` with `words.length - 1` in line 9.

### 4. Validate the Fix with ProTI

Run ProTI again:

```
npx jest
```

Even though you fixed the program, ProTI still finds the same issue as before. This is because of the imprecision of our current type-based generator and oracle. The type of `RandomInteger.result` is `number`, wherefore the simple generator generates any number for the tests, ignoring the `min` and `max` input configuration of the user. Better, future plugins should implement the behavior of the `RandomInteger` resource type correctly, finding the bug reliably, but only when it really exists.

### 5. Narrowing the Generator

As the range in which the used generator plugin generates values for `RandomInteger.result` is too wide, we narrow it with ProTI's inline specification syntax.

Import the inline specification syntax by adding the following to the beginning of the program:

```
import * as ps from "@proti-iac/spec";
```

Then replace `rng.result` in line 12 (before line 11) with:

```
ps.generate(rng.result).with(ps.integer(rngRange))
```

While this update does not change the program's behavior when deploying RWW with Pulumi, it instructs ProTI with a precise value generator for `rng.result`: an integer value in the range `rngRange`, i.e., from 0 to 2.

### 6. Validate the Fix with ProTI

Run ProTI:

```
npx jest
```

You should see that ProTI executed successfully and did not find a bug in 100 test runs.

### 7. Bonus: Narrowing the Oracle

In some cases, the current type-based generator is too general, and the same issue applies to the oracle. For instance, `BucketObject`'s input property `content` is of type `string`, wherefore the oracle accepts any string. Suppose you want to ensure that the content is never empty, then you can use the inline specification syntax to ensure it. For this, wrap `content`'s assigned value in line 17 with `ps.expect(` and `).to((s) => s.length > 0)`. If you now rerun ProTI, no issue is found because the value for `content` is never empty. However, if you alter the program so that `content` may be empty, e.g., add an empty string to the array in line 6, ProTI will spot the bug.
