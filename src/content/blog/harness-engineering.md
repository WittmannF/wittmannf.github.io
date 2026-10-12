---
title: 'Harness Engineering: The Systems Layer That Turns LLMs Into Reliable Agents'
description: 'A practical guide to the runtime around AI agents: loops, tools, context, sandboxes, state, recovery, verification, and evaluation.'
pubDate: 2026-10-05T12:00:00-03:00
tags: ['AI', 'LLMs', 'Agents', 'Harness Engineering', 'MCP', 'AI Systems']
lang: 'en'
---

> **Prefer to learn visually?** Explore the [interactive Harness Engineering guide](https://wittmannf.github.io/harness-engineering/en/) with multiple chapters, diagrams, review questions, and a production checklist.

> **Leia em português:** [Engenharia de Harness: a camada de sistemas que transforma LLMs em agentes confiáveis](/pt/blog/harness-engineering-pt).

A capable language model is not, by itself, a working agent.

A model can analyze a task and generate a plausible next action. But something else must decide what information the model receives, which tools it can call, whether an action is allowed, where that action runs, how the result comes back, what survives a restart, and what counts as actual completion.

That surrounding systems layer is the **agent harness**.

And **harness engineering** is the discipline of designing it well.

This distinction explains a pattern that surprises many teams: two products can use the same model and still behave very differently. One reliably completes multi-step work; the other forgets constraints, picks the wrong tool, repeats side effects, or declares success without checking anything. The difference often lives outside the model weights—in the harness.

This article develops a practical mental model for that layer and shows how its pieces fit together.

---

## 1. A Model Call Is Not an Agent

A language-model invocation can be written abstractly as:

```text
y ~ pθ(· | c)
```

The model generates an output `y` conditioned on context `c`.

Nothing in that expression automatically means that:

- a command runs;
- a browser opens;
- a file changes;
- an API call is authorized;
- a failed action is retried safely;
- useful state survives the next process;
- the task continues after the first response; or
- the final result is verified.

An agentic system adds a control process around inference:

```text
agent system ≈ model + harness + environment
```

This is not a formal identity. It is a useful decomposition:

| Layer | Responsibility |
|---|---|
| **Model** | Learned capability: understanding, planning, generation, and action selection |
| **Harness** | Control: context assembly, looping, tool routing, policy, state, recovery, and verification |
| **Environment** | External reality: files, APIs, databases, browsers, shells, and services |

The key boundary is not whether a product is marketed as a “chatbot” or an “agent.” The important question is whether model output participates in a controlled loop that can inspect and change external state.

---

## 2. The Minimal Agent Loop

A minimal harness repeatedly performs six jobs:

1. assemble the active context;
2. invoke the model;
3. inspect whether the response is final or requests an action;
4. apply policy, permissions, and approval rules;
5. execute the action in an environment;
6. return the observation and update state.

Conceptually:

```text
Task
  ↓
Assemble active context
  ↓
Invoke model
  ↓
Final answer or action request?
  ├── final → return result
  └── action
        ↓
     policy / approval / routing
        ↓
     execute in environment
        ↓
     observation + state update
        └──────────────→ next model call
```

One way to formalize the evolving objects is:

```text
sₜ       = durable or working state before step t
cₜ=G(sₜ) = context selected for the next call
aₜ=M(cₜ) = model output or action request
oₜ=E(aₜ) = observation produced by the environment

sₜ₊₁ = U(sₜ, aₜ, oₜ)
```

The important idea is simple: **act, observe, update, continue**.

The model supplies decisions. The harness gives those decisions operational continuity.

### A small implementation sketch

```python
state = initialize(task)

while not state.is_terminal:
    context = select_context(state)
    response = model.generate(context, tools=visible_tools(state))

    if response.is_final:
        state = verify_and_finish(state, response)
        continue

    request = validate_tool_request(response.tool_call)
    authorize(request, state.policy)
    observation = execute(request, sandbox=state.sandbox)
    state = update(state, request, observation)
```

Real systems are more complex, but every additional feature—memory, approvals, subagents, checkpoints—still belongs somewhere around this loop.

---

## 3. The Components People Commonly Conflate

Several terms are often used as if they meant the same thing. They do not.

| Component | Useful meaning | Typical failure |
|---|---|---|
| **Model** | Learned inference system | Misunderstands or chooses poorly |
| **Agent** | Model operating inside an action loop toward a task | Fails to make progress toward the goal |
| **Harness** | Runtime and control machinery driving the loop | Supplies bad context, routing, policy, or recovery |
| **Session** | Logical container for history and task state | Loses progress across turns or restarts |
| **Context** | Information supplied to one model invocation | Omits, buries, or overloads relevant evidence |
| **Tool** | Callable capability exposed to the model | Has an ambiguous contract or noisy result |
| **Sandbox** | Controlled execution environment | Exposes too much—or lacks a required capability |
| **Workflow** | Execution path largely specified by application code | Is too rigid for the task |
| **Evaluation harness** | Infrastructure that runs and grades trials | Measures the wrong outcome or unstable environment |

These boundaries can share a process in a prototype. They remain conceptually useful because they carry different trust assumptions and fail in different ways.

---

## 4. Tools Are Part of the Model Input

A tool is not only backend code. Its **name, description, parameters, schema, and result format** usually enter the model's context.

That means tool design changes model behavior before the tool is ever called.

Consider two interfaces that can modify the same repository:

```text
shell(command)
```

versus:

```text
read_file(path, start_line, end_line)
search_code(query)
apply_patch(path, patch)
run_tests(target)
```

The shell has enormous affordance, but it forces the model to choose commands, quote paths, interpret arbitrary output, and recover from syntax errors. Structured tools narrow the action surface and can make intent and outcome easier to express.

Neither design is universally best. The point is that the interface changes the effective difficulty of the task.

### Evaluate every tool on four dimensions

1. **Affordance** — What operation can it perform?
2. **Contract** — How does the model request the operation?
3. **Observation** — What information comes back?
4. **Feedback** — Does the result make the next correct action easier?

A useful cost model is:

```text
Ctool = Cselection + Cobservation
```

- `Cselection`: difficulty of choosing the correct tool and arguments;
- `Cobservation`: reasoning and context burden imposed by the result.

This explains why adding tools can reduce reliability. Six overlapping operations named `search`, `find`, `lookup`, `query`, `grep`, and `retrieve` increase capability on paper while making selection ambiguous.

### A high-signal tool error

Compare this:

```text
Error.
```

with this:

```json
{
  "status": "failed",
  "reason": "branch_not_found",
  "requested_branch": "release/2.4",
  "available_branches": ["main", "release/2.3"],
  "side_effects": "none",
  "retryable": true
}
```

The second result turns failure into a useful observation. The model can recover without guessing—and without pretending the action succeeded.

---

## 5. MCP Is an Interface Layer, Not the Whole Agent

The [Model Context Protocol](https://modelcontextprotocol.io/) standardizes how AI applications connect to external capabilities such as tools, resources, and prompts.

That solves an important interoperability problem. It does not define the entire agent architecture.

MCP does not, by itself, decide:

- how the model loop is scheduled;
- which history enters the next context;
- which calls require approval;
- where tools execute;
- how side effects are retried;
- how subagents coordinate;
- what proves completion; or
- how the whole system is evaluated.

The safe mental model is:

```text
Agent harness
    ↓
MCP client
    ↓
MCP servers → tools · resources · prompts · optional extensions
```

MCP provides interoperable capability surfaces. The harness owns the operational policy around them.

---

## 6. Active Context Is Not Durable Memory

Every model call sees a finite context. The harness decides what enters it.

Possible ingredients include:

- system and developer instructions;
- the current task;
- recent conversation history;
- tool schemas and results;
- retrieved documentation;
- plans and todo state;
- summaries of earlier work;
- repository or application state;
- memory records; and
- subagent reports.

The naive policy—include everything that might matter—fails for two reasons:

1. context capacity is finite;
2. irrelevant material competes with useful evidence even when capacity remains.

A production harness should separate two state surfaces:

| Surface | Purpose |
|---|---|
| **Durable session state** | Preserve events, decisions, artifacts, IDs, and history across turns or restarts |
| **Active model context** | Present the smallest useful view for the current inference |

Persistence does not imply automatic inclusion in every call. Inclusion in one call does not imply durable storage.

### Progressive disclosure

A strong pattern is:

1. give enough information to orient the agent;
2. make deeper information discoverable;
3. retrieve detailed guidance only when needed.

This pattern applies to repository documentation, tool results, RAG, memory, and skills.

### Compaction is lossy

When history grows, systems often replace older detail with a summary:

```text
C(H) ≠ H
```

A compacted history is not the original history. It may omit exactly the detail a later step needs.

Good designs therefore keep durable history recoverable while treating compacted context as a temporary view.

---

## 7. Security Requires More Than Approval Prompts

Once an agent can create side effects, security becomes architectural.

Three mechanisms are often conflated:

### Permissions

Define which operations are authorized for the agent or user.

### Human approval

Keeps consequential decisions—publishing, deleting, sending, spending, escalating privilege—under explicit human control.

### Containment

Limits what the execution environment can reach even if instructions, policy checks, or approvals fail.

Examples include:

- filesystem boundaries;
- network egress rules;
- containers and VMs;
- process and resource limits;
- credential isolation; and
- scoped proxies for external services.

Approval answers: **“Should this action happen?”**

Containment answers: **“What can happen at all?”**

Both matter.

### Keep credentials outside untrusted execution

If model-generated code runs in a sandbox containing long-lived credentials, prompt injection, a malicious dependency, or an incorrect command may read them.

A stronger design keeps credentials in a trusted control plane and exposes narrow operations through a proxy:

```text
Sandbox without raw secret
        ↓
Controlled proxy: scope + policy + audit
        ↓
External service
```

A secret that never enters the sandbox cannot be read directly from it.

### Observations have provenance

Agent context may include web pages, emails, files, issue descriptions, tool results, memory, skills, and subagent output. Any of these may contain hostile or misleading instructions.

A useful mental model is:

```text
observation = (content, source, trust, time, permissions)
```

All text becomes tokens, but not all tokens have equal authority.

---

## 8. Long-Running Agents Inherit Distributed-Systems Problems

A five-second tool call can often fail and be retried with little coordination. A task lasting hours or days is different.

During long-running work:

- the harness can crash;
- a worker can disappear;
- a sandbox can be reclaimed;
- the network can disconnect;
- approval can arrive much later; and
- another process may need to resume the task.

The system needs durable events, checkpoints, recoverable artifacts, and a way to reconcile what the harness remembers with what happened in the external world.

### The dangerous gap

Suppose the harness requests:

```text
create_ticket(...)
```

The remote system creates the ticket, but the connection drops before the response arrives.

Now four transitions may disagree:

```text
requested action
executed action
observed result
committed task state
```

Blind retry can create a duplicate ticket.

### Idempotency must be tool-specific

An idempotent operation has the same intended effect when repeated:

```text
f(f(s)) = f(s)
```

`set_ticket_status(id, "closed")` can often be designed as idempotent. `charge_card`, `send_email`, and `create_order` are not naturally safe to repeat.

Common protections include:

- idempotency keys;
- unique operation IDs;
- deduplication records;
- transactional writes;
- read-before-retry checks; and
- tool-specific retry policies.

“Retry on failure” is not a universal strategy.

---

## 9. Subagents Add Coordination Costs

Subagents can improve throughput when a task decomposes into independent pieces. They can also introduce:

- duplicated work;
- inconsistent assumptions;
- communication overhead;
- higher token cost;
- error propagation; and
- conflicts over shared state.

Delegate when:

- subtasks have clear boundaries;
- sources or modules are independent;
- outputs can be checked objectively; and
- the integration owner is explicit.

Avoid delegation when:

- every step depends on the previous one;
- all workers need the same large context;
- they write to the same state; or
- coordination costs more than the work.

Multi-agent design is not only a prompting problem. It is a consistency and ownership problem.

---

## 10. Verification Is Different From Self-Reported Completion

An agent can say:

> The bug is fixed.

That is a claim—not evidence.

Stronger evidence might include:

- the original reproduction no longer fails;
- regression tests pass;
- the application works end to end;
- the database contains the intended state;
- the browser shows the expected result; or
- the external API confirms the outcome.

A useful evidence ladder is:

```text
model claim
    ↓
artifact exists
    ↓
deterministic checks pass
    ↓
external state satisfies the goal
```

Whenever possible, completion should be tied to state outside the model's own assertion.

### Mechanism versus judgment

Use deterministic enforcement for mechanically decidable properties:

- valid JSON;
- schema compliance;
- path boundaries;
- forbidden dependencies;
- resource budgets; and
- tests and invariants.

Use model or human judgment when interpretation is genuinely required:

- relevance;
- prose quality;
- design quality;
- ambiguous planning; and
- policy interpretation.

The model should not have to remember a rule the system can enforce cheaply.

---

## 11. An Agent Harness Operates; an Evaluation Harness Measures

An **agent harness** lets the model act.

An **evaluation harness** provisions tasks and environments, runs trials, records trajectories, invokes graders, and aggregates outcomes.

Agent performance is therefore a function of more than model weights:

```text
measured performance = F(model, harness, environment, task, grader)
```

Change the context policy, tool schemas, compute limits, timeouts, or grader, and the score can change without changing the model.

Good evaluation measures:

- final-state correctness, not only plausible transcripts;
- consistency across repeated trials;
- tool-selection and contract failures;
- context and recovery failures;
- cost, latency, tokens, and tool calls; and
- adverse side effects and policy violations.

### Harness components are hypotheses

A planner, evaluator, context-reset mechanism, or multi-agent layer exists because someone believes it compensates for a current limitation.

When models improve, that hypothesis may expire.

Run ablations:

- remove the planner—does quality change?
- remove the evaluator—does it catch real defects?
- reduce the tool set—does selection improve?
- change compaction—does continuity improve enough to justify cost?

Harnesses should evolve with the models and tasks they serve.

---

## 12. A Production Checklist

Before deploying an agent, answer these questions explicitly:

1. **What does the model receive?** Instructions, history, tools, retrieved data, summaries, and artifacts.
2. **Who controls the loop?** Application code, a managed harness, a workflow engine, or another agent.
3. **Which actions are available?** Functions, MCP tools, shell, browser, files, APIs, and subagents.
4. **Where do actions execute?** Trusted process, local machine, container, VM, or remote service.
5. **What survives a crash?** Events, files, checkpoints, snapshots, and external effects.
6. **Which rules are enforced mechanically?** Schemas, mounts, network boundaries, approvals, tests, and budgets.
7. **How are errors represented?** Fatal exception, automatic retry, model-visible observation, or human escalation.
8. **Which actions are safe to retry?** Idempotent, deduplicated, or neither.
9. **How does the agent obtain ground truth?** Tests, logs, browser state, database state, and external responses.
10. **What proves completion?** A claim, validator, external state, evaluator, or human.
11. **How does a run stop if it never succeeds?** Turn, time, token, cost, tool, and policy budgets.
12. **What happens after interruption?** Resume, retry, reprovision, rollback, or restart.
13. **Can untrusted observations carry instructions?** Web data, tools, files, memory, skills, and subagent reports.
14. **How are subagents coordinated?** Task boundaries, ownership, shared state, merge policy, and concurrency limits.
15. **How is the harness evaluated?** Representative tasks, stable environments, outcome metrics, and ablations.

If a system cannot answer these questions, it may still work in a demo. It is much harder to reason about in production.

---

## Closing Mental Model

The core of harness engineering fits into nine statements:

1. The model supplies learned capability.
2. The harness connects that capability to work.
3. Durable state determines what survives.
4. Context policy determines what the model sees now.
5. The execution environment determines what can actually happen.
6. Permissions and containment determine how far failure can reach.
7. Feedback reveals whether an action worked.
8. Verification turns “done” into evidence.
9. Evaluation determines whether the harness helps or merely adds machinery.

That is the systems layer between an impressive model call and an agent you can trust with real work.

For the diagram-rich version of this material, continue with the [interactive Harness Engineering guide](https://wittmannf.github.io/harness-engineering/en/).

---

## Further Reading

- [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)
- [SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering](https://arxiv.org/abs/2405.15793)
- [Anthropic — Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- [Anthropic — Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
- [Anthropic — Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Anthropic — Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [OpenAI — Harness engineering](https://openai.com/index/harness-engineering/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [IETF RFC 9110 — Idempotent methods](https://www.rfc-editor.org/rfc/rfc9110.html#name-idempotent-methods)
