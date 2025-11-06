---
title: Rag优化方案
description: RAG系统检索模块优化方案，包括混合检索、Reranker精排、查询扩展等技术，提升检索准确性和用户体验。
publishDate: 2025-08-07
tags:
  - Rag
language: 中文
slug: rag
---

## 前言

检索增强生成（RAG）已经成为构建智能问答、知识库助手的核心技术。然而，一个基础的 RAG 系统在面对复杂业务场景时，其检索模块的准确性往往成为瓶颈。

-----

## 1、 RAG优化方案

1.  **混合检索 (Hybrid Search)**: 融合传统关键词（BM25）与现代向量（Semantic）搜索，兼顾精确匹配与语义理解。
2.  **Reranker 精排**: 使用更强大的 AI 模型对初步检索结果进行二次排序，提升顶层结果的相关性。
3.  **排序与体验优化**: 引入标题加权、日期衰减等策略优化排序，并通过高亮和聚类提升用户体验。
4.  **智能查询扩展**: 结合动态词库和多种匹配模式（Match/Match Phrase），更好地理解用户意图。

## 2、 第一步：实现混合检索 (Hybrid Search)

混合检索是提升召回率和相关性的第一道防线。我们将在 Elasticsearch 中同时执行 BM25 关键词搜索和向量搜索，并融合其结果。

### 准备工作

首先，在你的 `pom.xml` 中加入 Elasticsearch Java 客户端的依赖：

```xml
<dependency>
    <groupId>co.elastic.clients</groupId>
    <artifactId>elasticsearch-java</artifactId>
    <version>8.14.0</version>
</dependency>
<dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
    <version>2.17.1</version>
</dependency>
```

### 示例代码

假设我们的索引 `documents` 中包含 `title`、`content` (text类型) 和 `content_vector` (dense\_vector类型) 字段。

```java
import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import co.elastic.clients.elasticsearch._types.query_dsl.QueryBuilders;
import co.elastic.clients.elasticsearch.core.SearchRequest;
import co.elastic.clients.elasticsearch.core.SearchResponse;

// ... 假设 esClient 已经注入

public SearchResponse<MyDocument> hybridSearch(String userQuery, float[] queryVector) throws IOException {

    // 1. 构建关键词查询 (BM25)
    Query keywordQuery = QueryBuilders.multiMatch(m -> m
            .query(userQuery)
            .fields("title^2", "content") // 标题权重加倍
            .fuzziness("AUTO")
    );

    // 2. 构建向量查询 (k-NN)
    Query vectorQuery = QueryBuilders.knn(k -> k
            .field("content_vector")
            .queryVector(queryVector)
            .k(10)
            .numCandidates(50)
    );

    // 3. 将两者组合在一个查询中
    // 注意: Elasticsearch 8.4+ 直接支持混合检索。对于旧版本，可能需要两次查询后在客户端融合。
    // 这里展示的是 8.4+ 的原生混合查询方式。
    SearchRequest request = new SearchRequest.Builder()
            .index("documents")
            .query(keywordQuery) // BM25 作为主查询
            .knn(k -> k           // k-NN 作为补充
                .field("content_vector")
                .queryVector(queryVector)
                .k(10)
                .numCandidates(50)
                .boost(0.5f) // 可选：给向量搜索结果一个权重
            )
            .build();

    // 对于更灵活的融合（如 RRF），你也可以分开执行两个查询，然后在Java代码中融合结果。
    // RRF (Reciprocal Rank Fusion) 是一种更高级的客户端融合策略。

    return esClient.search(request, MyDocument.class);
}
```

**代码解析**:

* 我们构建了一个 `multiMatch` 查询来进行关键词搜索，并使用 `title^2` 实现了**标题加权**。
* 我们构建了一个 `knn` 查询来进行向量搜索。`queryVector` 需要通过一个 Embedding 模型服务（如 OpenAI、Hugging Face）提前生成。
* 在 Elasticsearch 8.4+ 中，可以直接将 `query` 和 `knn` 放在同一个请求中，ES 会自动进行分数融合。

## 3、 第二步：引入 Reranker 模型精排

混合搜索召回了 Top-N 个候选文档，现在我们用 Reranker 模型给它们打一个更准的分数。Reranker 通常作为一个独立的微服务存在。

### 示例代码

我们将模拟一个 API 调用，将查询和候选文档发送给 Reranker 服务。

```java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.stream.Collectors;

// ...

public List<MyDocument> rerank(String userQuery, List<MyDocument> initialResults) {
    // Reranker 服务地址
    String rerankerApiEndpoint = "http://your-reranker-service.com/rerank";

    // 构建请求体
    // 格式: [{"query": "user query", "text": "document content 1"}, {"query": "...", "text": "..."}]
    String requestBody = initialResults.stream()
            .map(doc -> String.format("{\"query\": \"%s\", \"text\": \"%s\"}",
                                      escapeJson(userQuery),
                                      escapeJson(doc.getContent())))
            .collect(Collectors.joining(",", "[", "]"));

    HttpClient client = HttpClient.newHttpClient();
    HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(rerankerApiEndpoint))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(requestBody))
            .build();

    try {
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        // 解析 Reranker 返回的分数，并对 initialResults 进行重排序
        // 假设返回格式: [0.98, 0.23, 0.75, ...]
        List<Double> scores = parseScores(response.body());

        for (int i = 0; i < initialResults.size(); i++) {
            initialResults.get(i).setRerankScore(scores.get(i));
        }

        // 按 rerankScore 降序排序
        initialResults.sort((d1, d2) -> Double.compare(d2.getRerankScore(), d1.getRerankScore()));

        return initialResults;

    } catch (Exception e) {
        // 异常处理：可选择返回原始结果或抛出异常
        e.printStackTrace();
        return initialResults;
    }
}

// 辅助方法
private String escapeJson(String text) {
    return text.replace("\"", "\\\"");
}

private List<Double> parseScores(String jsonResponse) {
    // 使用 Jackson 或 Gson 等库来解析 JSON 数组
    // ... 实现略
}
```

**代码解析**:

* 我们将初步检索到的文档内容和用户查询打包，通过 HTTP POST 请求发送给 Reranker 服务。
* Reranker 服务（通常基于 Cross-Encoder 模型）返回一个相关性分数列表。
* Java 客户端接收到分数后，对原始结果列表进行重新排序，得到最终的精准排序。

## 4、 第三步：排序优化与体验增强

除了 Reranker，我们还可以利用 Elasticsearch 的内置功能进一步优化排序和用户体验。

### 日期衰减排序 (Date Decay)

对于新闻、日志等时效性强的文档，新发布的应该排名更靠前。

```java
// ...

public SearchResponse<MyDocument> searchWithDateDecay(String userQuery) throws IOException {

    Query matchQuery = QueryBuilders.match(m -> m.field("content").query(userQuery));

    // 构建 Function Score Query
    Query functionScoreQuery = QueryBuilders.functionScore(fs -> fs
            .query(matchQuery) // 基础查询
            .functions(f -> f
                .gauss(g -> g // 使用高斯衰减函数
                    .field("publish_date") // 作用于日期字段
                    .origin("now")         // 以当前时间为中心
                    .scale("30d")          // 30天后，分数衰减到约0.6
                    .offset("7d")          // 7天内，分数不衰减
                    .decay(0.5)
                )
            )
            .boostMode("multiply") // 将衰减分数与原始分数相乘
    );

    SearchRequest request = SearchRequest.of(s -> s
            .index("documents")
            .query(functionScoreQuery)
    );

    return esClient.search(request, MyDocument.class);
}
```

**代码解析**:

* 我们使用了 `function_score` 查询，它允许我们修改由主查询 `matchQuery` 计算出的 `_score`。
* `gauss` 函数定义了一个衰减曲线：离 `now`（当前时间）越远的文档，其分数衰减得越厉害。

### 结果高亮 (Highlighting)

让用户快速定位到文档中的匹配项。

```java
// ...

public SearchResponse<MyDocument> searchWithHighlight(String userQuery) throws IOException {
    SearchRequest request = SearchRequest.of(s -> s
            .index("documents")
            .query(q -> q.match(m -> m.field("content").query(userQuery)))
            .highlight(h -> h
                .fields("content", f -> f // 对 content 字段进行高亮
                    .preTags("<mark>")    // 设置高亮前缀
                    .postTags("</mark>")   // 设置高亮后缀
                )
            )
    );

    SearchResponse<MyDocument> response = esClient.search(request, MyDocument.class);

    // 从 response 中提取高亮片段并附加到结果对象上
    response.hits().hits().forEach(hit -> {
        if (hit.highlight() != null && hit.highlight().containsKey("content")) {
            hit.source().setHighlightedContent(hit.highlight().get("content").get(0));
        }
    });

    return response;
}
```

**代码解析**:

* 在查询请求中增加了 `.highlight()` 部分，指定要高亮的字段和包裹的 HTML 标签。
* 在收到响应后，高亮片段在 `hit.highlight()` 中返回，你需要将其取出并附加到你的数据对象上，以便前端渲染。

## 5、 第四步：智能查询扩展

### 双检索模式 (Match / Match Phrase)

根据场景提供不同精度的搜索。

```java
// ...

// 宽松匹配 (Match)
public Query createMatchQuery(String userQuery) {
    return QueryBuilders.match(m -> m
            .field("content")
            .query(userQuery)
    );
}

// 短语匹配 (Match Phrase)
public Query createMatchPhraseQuery(String userQuery) {
    return QueryBuilders.matchPhrase(mp -> mp
            .field("content")
            .query(userQuery)
            .slop(1) // 允许词之间有1个词的间隔，增加灵活性
    );
}
```

**代码解析**:

* `match` 查询会将 "quick brown fox" 分词，并查找包含 `quick` 或 `brown` 或 `fox` 的文档。
* `match_phrase` 查询会严格查找 "quick brown fox" 这个连续的短语。`slop` 参数可以增加一些灵活性。

### 动态词库 (Dynamic Thesaurus)

动态词库的实现偏向于架构设计。一个常见的模式是：

1.  **离线分析**: 定期分析用户搜索日志，或使用 LLM 生成同义词。
2.  **更新词库**: 将新的同义词对更新到 Elasticsearch 的同义词词典文件中。
3.  **重载索引**: 调用 `_reload_search_analyzers` API 让索引加载最新的同义词典，无需停机。

在 Java 端，我们主要关注如何**使用**这个已经配置好的同义词分析器。当你为字段配置了同义词分析器后，无需在查询时做任何特殊操作，ES 会自动进行同义词扩展。

例如，如果词库里有 `ai -> 人工智能`，那么搜索 `ai` 时，ES 会自动扩展为搜索 `(ai OR 人工智能)`。

## 6. 最终整合：构建完整的RAG流程

现在，我们将所有部分串联起来，形成一个完整的检索流程。

```java
public class AdvancedRagService {

    private ElasticsearchClient esClient;
    private EmbeddingServiceClient embeddingClient; // 模拟的向量生成服务
    private RerankerClient rerankerClient;         // 模拟的Reranker服务
    private LlmClient llmClient;                   // 模拟的大模型服务

    // ... 构造函数注入依赖

    public String answer(String userQuery) {

        // 1. 生成查询向量
        float[] queryVector = embeddingClient.generateVector(userQuery);

        // 2. 执行混合搜索 (包含标题加权、日期衰减等)
        SearchResponse<MyDocument> searchResponse = searchWithOptimizations(userQuery, queryVector);
        List<MyDocument> initialDocs = searchResponse.hits().hits().stream()
                                           .map(Hit::source).collect(Collectors.toList());

        // 3. Reranker 精排
        List<MyDocument> rerankedDocs = rerankerClient.rerank(userQuery, initialDocs);

        // 4. 提取 Top-K 文档作为上下文
        List<String> contextSnippets = rerankedDocs.stream()
                                            .limit(3) // 取最相关的3个文档
                                            .map(MyDocument::getContent)
                                            .collect(Collectors.toList());

        // 5. 构建 Prompt 并调用 LLM
        String context = String.join("\n---\n", contextSnippets);
        String prompt = String.format(
            "基于以下信息回答问题: \"%s\". 信息: %s",
            userQuery,
            context
        );

        return llmClient.generateAnswer(prompt);
    }

    private SearchResponse<MyDocument> searchWithOptimizations(String userQuery, float[] queryVector) {
        // ... 此处整合 Section 2 和 Section 4 的查询构建逻辑 ...
        // 返回一个包含混合搜索、日期衰减、高亮等功能的复杂查询结果
    }
}
```
