<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Graph execution | https://docs.langchain.com/oss/python/langgraph/frontend/graph-execution -->

# 图执行

通过每个节点的状态和流内容可视化多步骤图形管道

LangGraph 代理不是黑匣子。每个图都由**命名节点**组成
依次或并行执行：分类、研究、分析、
合成。图形执行卡通过渲染卡使该管道可见
对于每个节点，显示其状态，实时传输其内容，以及
跟踪整个工作流程的完成情况。用户准确地看到代理的内容
正在做什么，正在进行哪一步，以及每一步产生了什么。

这种模式对于生产代理特别有用，因为它可以将图形转变为图形
结构到产品用户体验中。而不是把跑步当作一个单独的助手
响应，您可以公开相同的检查点、节点名称、状态密钥和
LangGraph 内部使用的流元数据。

<PatternEmbed />

## 图形节点如何映射到 UI 卡

LangGraph 图定义了一系列节点，每个节点负责特定的任务
任务。例如，研究管道可能具有：

1. **分类**：对用户的查询进行分类
2. **研究**：收集相关信息
3. **分析**：从研究中得出结论
4. **综合**：产生最终的、完善的响应每个节点将其输出写入图状态中的特定键。上
前端，您不需要像 [⟦T12⟧](https://reference.langchain.com/javascript/langchain-react/index/useStream) 发现的那样硬编码该映射
每个节点通过 `stream.subgraphs` 运行并公开
[⟦T14⟧](https://reference.langchain.com/javascript/langchain-react/SubgraphDiscoverySnapshot) 对于每个观察到的步骤：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
// Nodes are discovered automatically — no hardcoded list needed
const graphNodes = [...stream.subgraphs.values()];

// Each snapshot carries the node name and current status
graphNodes.forEach((node) => {
  console.log(node.nodeName, node.status); // "classify", "running"
});
```

使用 `node.nodeName` 作为进度条和卡片标题中的标签。通过每个
快照到`useMessages(stream, node)`以渲染节点范围的流内容
无需将 UI 与图形状态键名称耦合。

该映射成为图表和 UI 之间的契约。后端
作者可以有意添加、重命名或重新排序节点，而前端作者
决定每个状态键的可视化方式：状态徽章、Markdown 面板、
表格、图表、跟踪视图或批准卡。

## 设置`useStream`

像往常一样连接[⟦T18⟧](https://reference.langchain.com/javascript/langchain-react/index/useStream)。您将使用的关键属性是 `messages`
（对于对话）和`subgraphs`（对于在
当前运行）。将每个发现的子图快照传递给选择器以读取
消息范围仅限于该节点。

<Info>
  代码示例使用 `useStream<typeof myAgent>` 来实现类型安全的流状态。请参阅 [Python](/oss/python/langchain/frontend/overview#type-inference) 或 [JavaScript](/oss/javascript/langchain/frontend/overview#type-inference) 后端的类型推断。
</Info>

<CodeGroup>
  ```tsx React theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { useStream } from "@langchain/react";

  const AGENT_URL = "http://localhost:2024";

  export function PipelineChat() {
    const stream = useStream<typeof myAgent>({
      apiUrl: AGENT_URL,
      assistantId: "graph_execution_cards",
    });
    const graphNodes = [...stream.subgraphs.values()];

    return (
      <div>
        <PipelineProgress nodes={graphNodes} isLoading={stream.isLoading} />
        <NodeCardList nodes={graphNodes} stream={stream} isLoading={stream.isLoading} />
      </div>
    );
  }
  ```

  ```vue Vue theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  <script setup lang="ts">
  import { useStream } from "@langchain/vue";

  const AGENT_URL = "http://localhost:2024";

  const stream = useStream<typeof myAgent>({
    apiUrl: AGENT_URL,
    assistantId: "graph_execution_cards",
  });
  </script>

  <template>
    <div>
      <PipelineProgress
        :nodes="[...stream.subgraphs.value.values()]"
        :is-loading="stream.isLoading.value"
      />
      <NodeCardList
        :nodes="[...stream.subgraphs.value.values()]"
        :stream="stream"
        :is-loading="stream.isLoading.value"
      />
    </div>
  </template>
  ```

  ```svelte Svelte theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  <script lang="ts">
    import { useStream } from "@langchain/svelte";

    const AGENT_URL = "http://localhost:2024";

    const stream = useStream<typeof myAgent>({
      apiUrl: AGENT_URL,
      assistantId: "graph_execution_cards",
    });
  </script>

  <div>
    <PipelineProgress nodes={[...stream.subgraphs.values()]} isLoading={stream.isLoading} />
    <NodeCardList
      nodes={[...stream.subgraphs.values()]}
      {stream}
      isLoading={stream.isLoading}
    />
  </div>
  ```

  ```ts Angular theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { Component, computed } from "@angular/core";
  import { injectStream } from "@langchain/angular";

  const AGENT_URL = "http://localhost:2024";

  @Component({
    selector: "app-pipeline-chat",
    template: `
      <div>
        <app-pipeline-progress
          [nodes]="graphNodes()"
          [isLoading]="stream.isLoading()"
        />
        <app-node-card-list
          [nodes]="graphNodes()"
          [stream]="stream"
          [isLoading]="stream.isLoading()"
        />
      </div>
    `,
  })
  export class PipelineChatComponent {
    stream = injectStream<typeof myAgent>({
      apiUrl: AGENT_URL,
      assistantId: "graph_execution_cards",
    });

    graphNodes = computed(() => [...this.stream.subgraphs().values()]);
  }
  ```
</CodeGroup>

## 将流令牌路由到节点随着图流式传输，每个发现的子图快照都会标识它的节点
属于.将该快照传递给选择器挂钩或可组合项以读取
作用于该节点的消息：

```tsx theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { AIMessage } from "langchain";
import { useMessages, type AnyStream, type SubgraphDiscoverySnapshot } from "@langchain/react";

function NodeCard({
  node,
  stream,
}: {
  node: SubgraphDiscoverySnapshot;
  stream: AnyStream;
}) {
  const messages = useMessages(stream, node);
  const lastAIMessage = messages.find(AIMessage.isInstance);
  const streamingContent = lastAIMessage?.text ?? "";

  return <NodeCardBody node={node} content={streamingContent} />;
}
```

第一个安装的选择器打开该节点命名空间的范围订阅。
当节点卡卸载时，订阅会自动释放。

## 判断节点状态

每个发现的节点都带有其当前状态。直接使用`node.status`；
发现快照报告 `"pending"`、`"running"`、`"complete"`，或
`"error"`：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
type NodeStatus = SubgraphDiscoverySnapshot["status"];

const status: NodeStatus = node.status;
```

## 构建管道进度条

顶部的水平进度条让用户可以鸟瞰整个过程
整个管道。每个步骤都是一个带标签的段，在节点完成时填充：

```tsx theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
function PipelineProgress({
  nodes,
  isLoading,
}: {
  nodes: SubgraphDiscoverySnapshot[];
  isLoading: boolean;
}) {
  const firstIncompleteIdx = nodes.findIndex((node) => node.status !== "complete");

  return (
    <div className="flex items-center gap-1">
      {nodes.map((node, i) => {
        const isRunning =
          isLoading && node.status !== "complete" && firstIncompleteIdx === i;
        const colors = {
          pending: "bg-gray-200 text-gray-500",
          running: "bg-blue-400 text-white animate-pulse",
          complete: "bg-green-500 text-white",
          error: "bg-red-500 text-white",
        };
        const status = isRunning ? "running" : node.status;

        return (
          <div key={node.id} className="flex items-center">
            <div
              className={`rounded-full px-3 py-1 text-xs font-medium ${colors[status]}`}
            >
              {node.nodeName}
            </div>
            {i < nodes.length - 1 && (
              <div
                className={`mx-1 h-0.5 w-6 ${
                  status === "complete" ? "bg-green-500" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

## 构建可折叠的 NodeCard 组件

每个节点都有自己的卡，显示状态徽章、内容（流或
最终），以及用于长输出的可折叠主体：

```tsx theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
function NodeCard({
  node,
  stream,
}: {
  node: SubgraphDiscoverySnapshot;
  stream: AnyStream;
}) {
  const [open, setOpen] = useState(node.status === "running");
  const messages = useMessages(stream, node);
  const lastAIMessage = messages.find(AIMessage.isInstance);

  useEffect(() => {
    if (node.status === "running") setOpen(true);
    if (node.status === "complete") setOpen(false);
  }, [node.status]);

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4"
      >
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">{node.nodeName}</h3>
          <StatusBadge status={node.status} />
        </div>
        <span className={open ? "rotate-90" : ""}>▶</span>
      </button>

      {open && (
        <div className="border-t px-4 py-3">
          <div className="prose prose-sm max-w-none">
            {lastAIMessage?.text?.trim()
              ? <Markdown>{lastAIMessage.text}</Markdown>
              : <p className="italic text-gray-500">Processing...</p>}
          </div>
        </div>
      )}
    </div>
  );
}
```

## 流媒体内容与完整内容

节点卡读取流媒体和最终内容的范围消息。这个
避免假设图节点名称与其写入的状态键匹配（例如
例如，`do_research`写入游乐场图中的`research`）：|来源 |何时使用 |
| ------------------------ | | ------------------------------------------------------------------------------------------ |
| `useMessages(stream, node)` |渲染节点范围的流和最终消息 |
| `stream.values` |使用实际状态键读取整个图状态，例如最终的 `synthesis` 字段 |

模式是：显示节点卡中最新的范围 AI 消息，以及
仅当您有意需要图状态字段时才使用`stream.values`。

由于作用域消息与生成节点相关联，因此 UI 可以支持
并行图路径，无需根据消息顺序进行猜测。每张卡更新自
属于其节点的流事件和完成的值仍然可用
通过`stream.values`。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
function NodeContent({ stream, node }: { stream: AnyStream; node: SubgraphDiscoverySnapshot }) {
  const messages = useMessages(stream, node);
  const content = messages.find(AIMessage.isInstance)?.text ?? "";

  return <Markdown>{content}</Markdown>;
}
```

<Tip>
  流媒体内容可能包含未经过处理的部分标记或降价
  尚未完全成型。如果您渲染 Markdown，请确保您的渲染器可以处理
  优雅地处理不完整的语法（例如，未闭合的粗体标记`**`）。
</Tip>

## 将它们放在一起

这是完整的卡列表，结合了路由、状态检测和卡
渲染：```tsx theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
function NodeCardList({
  nodes,
  stream,
  isLoading,
}: {
  nodes: SubgraphDiscoverySnapshot[];
  stream: AnyStream;
  isLoading: boolean;
}) {
  const firstIncompleteIdx = nodes.findIndex((node) => node.status !== "complete");

  return (
    <div className="space-y-3">
      {nodes.map((node, i) => {
        const isComplete = node.status === "complete";
        const isRunning = isLoading && !isComplete && firstIncompleteIdx === i;
        if (!isComplete && !isRunning) return null;

        return <NodeCard key={node.id} node={node} stream={stream} />;
      })}
    </div>
  );
}
```

## 用例

图形执行卡适用于可见性的任何多步骤管道
事项：

* **研究管道**：分类→收集来源→分析→综合
  报告
* **内容生成**：大纲→草稿→事实检查→编辑→发布
* **数据处理**：摄取→验证→转换→聚合→导出
* **代码生成**：理解需求→规划架构→编写
  代码→审查→测试
* **决策工作流程**：收集背景→评估选项→评分
  替代方案 → 推荐

## 处理动态管道

并非所有图都有一组固定的节点。某些管道添加或跳过节点
基于输入。发现图仅包含观察到的节点
当前线程：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const activeNodes = [...stream.subgraphs.values()];
```

这可确保您的 UI 仅显示与相关节点相关的卡片
当前执行，避免空占位卡。

<Info>
  如果您的图表具有条件分支（例如，跳过“研究”以获得简单的结果）
  事实查询），跳过的节点不会出现在`stream.subgraphs`中。你的
  管道进度条可以仅渲染已发现的节点或使预期节点变暗
  没有匹配的快照。
</Info>

## 最佳实践* **从流中发现节点**。来自`stream.subgraphs`的渲染卡
  而不是对预期节点进行硬编码；有条件或跳过的步骤不会
  出现直到他们跑。
* **将状态密钥视为 UI 合约**。决定哪个图形输出应该是
  足够稳定，以便前端渲染，并在接下来记录这些键
  到图形定义。
* **对节点卡使用范围消息**。它们在节点流式传输时工作
  完成后，无需将 UI 卡耦合到状态键名称。
* **自动折叠已完成的节点**。 在长管道中，自动折叠完成
  卡片，以便用户可以专注于当前活动的步骤。
* **显示预计时间**。如果您有每个节点多长时间的历史数据
  需要，显示时间估计来设置用户期望。
* **添加全局进度指示器**。补充每节点卡
  管道视图顶部的整体进度条（例如，“第 2 步，共 4 步”）。
* **处理每个节点的错误**。如果节点发生故障，则在其卡片中显示错误
  而不会使整个管道塌陷。其他节点仍可能完成
  成功。

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout><Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/frontend/graph-execution.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>