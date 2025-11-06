---
title: Arthas的简单使用
description: 详细介绍Arthas这款强大的Java诊断工具，包括安装启动、核心命令使用和实战应用，解决线上问题排查。
publishDate: 2025-08-05
updatedDate: 2025-08-06
tags:
  - 性能调优
  - 诊断工具
language: 中文
slug: arthas
---
## 🛠️ Arthas 简介

Arthas（阿尔萨斯）是阿里巴巴在2018年9月开源的一款强大的 Java 诊断工具，支持 JDK 6 及以上版本，提供命令行交互模式，支持多平台（Linux/Mac/Windows），并且带有 Tab 自动补全功能。Arthas 能够帮助开发者在不修改代码、不重启服务的情况下，对 Java 应用线上问题进行快速诊断和定位。

#### 🤔 为什么需要 Arthas?

日常开发中，遇到以下Java问题时，传统方法效率低：

- CPU负载飙高，但无法定位具体线程
- 线程死锁导致系统卡死，难实时查看线程状态
- 应用响应变慢，方法调用链不明确
- 线上代码和预期不一致，热部署后代码未生效
- 生产环境禁止远程调试，无法实时查看变量
- 缺乏实时的 JVM 状态和性能监控

正因为这些痛点，Arthas 应运而生，帮助开发者实现问题定位、实时监控和代码热更新等功能。

## 📦 安装和启动 Arthas

#### 安装方式

最简单的方法是下载官方提供的 arthas-boot.jar：

```bash
## 从GitHub下载
curl -O https://arthas.aliyun.com/arthas-boot.jar

## 国内用户推荐从Gitee下载
curl -O https://arthas.gitee.io/arthas-boot.jar
```

#### 启动方式

使用 java -jar 命令启动：

```bash
## 启动 Arthas 并选择 Java 进程
java -jar arthas-boot.jar

## 或者直接指定进程PID
java -jar arthas-boot.jar [PID]
```

运行后，会列出系统上的 Java 进程，选择需要诊断的进程编号即可。

## 📋 Arthas 常用命令

Arthas 命令丰富，可分为以下几类：

#### 基础命令

| 命令       | 功能说明              |
|------------|-----------------------|
| `help`     | 查看命令帮助信息      |
| `cat`      | 打印文件内容          |
| `grep`     | 搜索满足条件的结果    |
| `pwd`      | 返回当前工作目录      |
| `cls`      | 清空当前屏幕          |
| `session`  | 查看当前会话信息      |
| `reset`    | 重置类增强状态        |
| `version`  | 输出当前Arthas版本号  |
| `quit`     | 退出当前客户端        |
| `shutdown` | 关闭 Arthas 服务端    |

#### 监控命令

| 命令          | 功能说明                            |
|---------------|-----------------------------------|
| `dashboard`   | 显示当前系统实时数据面板          |
| `thread`      | 查看 JVM 线程堆栈信息             |
| `jvm`         | 查看 JVM 信息                     |
| `sysprop`     | 查看和修改 JVM 系统属性           |
| `sysenv`      | 查看 JVM 环境变量                 |
| `vmoption`    | 查看和修改 JVM 诊断相关选项       |
| `perfcounter` | 查看 JVM 性能计数器信息           |
| `logger`      | 查看和修改日志级别                 |

#### 类操作命令

| 命令         | 功能说明                        |
|--------------|--------------------------------|
| `sc`         | 查看已加载类信息                |
| `sm`         | 查看类的方法信息                |
| `jad`        | 反编译已加载类的源码           |
| `mc`         | 内存编译 Java 文件为 Class 文件 |
| `redefine`   | 重定义已加载类                  |
| `dump`       | 导出已加载类的字节码           |
| `classloader`| 查看类加载器继承树、路径等信息 |

#### 增强命令（需谨慎）

| 命令      | 功能说明                             |
|-----------|------------------------------------|
| `monitor` | 方法执行监控                       |
| `watch`   | 监控方法的入参和返回值             |
| `trace`   | 跟踪方法调用路径及耗时             |
| `stack`   | 输出当前方法调用路径               |
| `tt`      | 记录方法调用参数和返回值的时空隧道 |

## 🎯 实用案例

###### 案例1：定位 CPU 使用率高的线程

使用 `thread -n 3` 查看 CPU 使用率最高的三个线程，定位具体消耗资源的线程及堆栈。

###### 案例2：排查应用响应慢的问题

使用 `trace` 命令跟踪接口方法调用，找出耗时最长的方法。

###### 案例3：查看类加载信息

使用 `sc -d 类名` 查看指定类的详细加载信息，包括类加载路径、类加载器等，有助于排查类加载异常。

###### 案例4：检测并修复线程死锁

使用 `thread -b` 命令查找死锁线程，定位互相等待锁的线程。

###### 案例5：观察方法的入参和返回值

使用 `watch 类名 方法名 "{params, returnObj}" -x 2` 实时查看方法调用的参数和返回值，方便调试和理解业务行为。

## 🌐 Arthas Web Console

Arthas 提供了图形化 Web Console，启动 Arthas 后访问：http://127.0.0.1:8563/

Web Console 与命令行功能一致，支持命令历史和实时反馈，便于团队协作与问题排查。

## ⚠️ 注意事项

- Arthas 是诊断工具，生产环境使用需谨慎，需申请审批，建议避免在高峰期操作。
- 某些命令（如 trace、watch、tt）会修改字节码，可能影响性能，长期运行可能带来内存泄漏风险。
- 增强类会在 Arthas 退出时自动重置，可手动执行 `reset` 命令。
- 生产环境使用时应严格权限控制和操作日志记录。

## 📝 总结

通过本文，您已掌握 Arthas 的基础知识和实战应用，能够使用它高效排查Java线上问题，提升调优能力。建议在项目中多练习，逐步熟练掌握这款强大工具。

官方文档：https://arthas.aliyun.com/doc/
GitHub 仓库：https://github.com/alibaba/arthas
在线教程：https://arthas.aliyun.com/doc/arthas-tutorials.html
社区论坛：https://github.com/alibaba/arthas/discussions
