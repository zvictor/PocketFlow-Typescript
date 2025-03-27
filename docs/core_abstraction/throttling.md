---
layout: default
title: '(Advanced) Throttling'
parent: 'Core Abstraction'
nav_order: 5
---

# (Advanced) Throttling

**Throttling** helps manage concurrency and avoid rate limits when making API calls. This is particularly important when:

1. Calling external APIs with rate limits
2. Managing expensive operations (like LLM calls)
3. Preventing system overload from too many parallel requests

## Concurrency Control Patterns

### 1. Using Semaphores (Python)

```python
import asyncio

class LimitedParallelNode(Node):
    def __init__(self, concurrency=3):
        self.semaphore = asyncio.Semaphore(concurrency)

    async def exec(self, items):
        async def limited_process(item):
            async with self.semaphore:
                return await self.process_item(item)

        tasks = [limited_process(item) for item in items]
        return await asyncio.gather(*tasks)

    async def process_item(self, item):
        # Process a single item
        pass
```

### 2. Using p-limit (TypeScript)

```typescript
import pLimit from 'p-limit'

class LimitedParallelNode extends Node {
  constructor(private concurrency = 3) {
    super()
  }

  async exec(items) {
    const limit = pLimit(this.concurrency)
    return Promise.all(items.map((item) => limit(() => this.processItem(item))))
  }

  async processItem(item) {
    // Process a single item
  }
}
```

## Rate Limiting with Window Limits

{% tabs %}
{% tab title="Python" %}

```python
from ratelimit import limits, sleep_and_retry

# 30 calls per minute
@sleep_and_retry
@limits(calls=30, period=60)
def call_api():
    # Your API call here
    pass
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
import { RateLimiter } from 'limiter'

// 30 calls per minute
const limiter = new RateLimiter({ tokensPerInterval: 30, interval: 'minute' })

async function callApi() {
  await limiter.removeTokens(1)
  // Your API call here
}
```

{% endtab %}
{% endtabs %}

## Throttler Utility

{% tabs %}
{% tab title="Python" %}

```python
from tenacity import retry, wait_exponential, stop_after_attempt

@retry(
    wait=wait_exponential(multiplier=1, min=4, max=10),
    stop=stop_after_attempt(5)
)
def call_api_with_retry():
    # Your API call here
    pass
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
import pRetry from 'p-retry'

async function callApiWithRetry() {
  return pRetry(
    async () => {
      // Your API call here
    },
    {
      retries: 5,
      minTimeout: 4000,
      maxTimeout: 10000,
    },
  )
}
```

{% endtab %}
{% endtabs %}

## Advanced Throttling Patterns

### 1. Token Bucket Rate Limiter

{% tabs %}
{% tab title="Python" %}

```python
from pyrate_limiter import Duration, Rate, Limiter

# 10 requests per minute
rate = Rate(10, Duration.MINUTE)
limiter = Limiter(rate)

@limiter.ratelimit("api_calls")
async def call_api():
    # Your API call here
    pass
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
import { TokenBucket } from 'limiter'

// 10 requests per minute
const limiter = new TokenBucket({
  bucketSize: 10,
  tokensPerInterval: 10,
  interval: 'minute',
})

async function callApi() {
  await limiter.removeTokens(1)
  // Your API call here
}
```

{% endtab %}
{% endtabs %}

### 2. Sliding Window Rate Limiter

{% tabs %}
{% tab title="Python" %}

```python
from slidingwindow import SlidingWindowRateLimiter

limiter = SlidingWindowRateLimiter(
    max_requests=100,
    window_size=60  # 60 seconds
)

async def call_api():
    if not limiter.allow_request():
        raise RateLimitExceeded()
    # Your API call here
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
import { SlidingWindowRateLimiter } from 'sliding-window-rate-limiter'

const limiter = SlidingWindowRateLimiter.createLimiter({
  interval: 60, // 60 seconds
  maxInInterval: 100,
})

async function callApi() {
  const isAllowed = await limiter.check('key', 1)
  if (!isAllowed) throw new Error('Rate limit exceeded')
  // Your API call here
}
```

{% endtab %}
{% endtabs %}

{% hint style="info" %}
**Related Concepts**: Many throttling patterns are used with [Batch Processing](./batch.md) operations, particularly when dealing with parallel execution of API calls.
{% endhint %}

## Best Practices

1. **Monitor API Responses**: Watch for 429 (Too Many Requests) responses and adjust your rate limiting accordingly
2. **Implement Retry Logic**: When hitting rate limits, implement exponential backoff for retries
3. **Distribute Load**: If possible, spread requests across multiple API keys or endpoints
4. **Cache Responses**: Cache frequent identical requests to reduce API calls
5. **Batch Requests**: Combine multiple requests into single API calls when possible

## Linking to Related Concepts

For parallel processing without throttling, see [Parallel Nodes](./parallel.md).  
For batch processing patterns, see [Batch Processing](./batch.md).
