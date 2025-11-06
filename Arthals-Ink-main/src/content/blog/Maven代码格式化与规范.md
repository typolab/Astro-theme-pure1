---
title: Maven 项目中的代码格式与规范
description: 通过 Spotless 与 Checkstyle 两大插件，在 Maven 项目中建立统一的代码格式化与静态检查流程，稳住“机械化的质量红线”。
publishDate: 2025-09-18
updatedDate: 2025-09-18
tags:
  - 代码规范
  - Maven
  - Java
language: 中文
slug: maven-code-style
---

## 为什么要关注代码格式与规范

团队协作时，最常见的“隐形成本”就是风格不一致、无意间引入的坏味道。通过引入代码格式化与静态检查工具，可以提前把问题挡在 CI 之外，保证合并分支时差异更聚焦于业务逻辑，也让 Code Review 更轻松。

本文介绍如何在 Maven 项目里接入 Spotless 与 Checkstyle，将“格式 + 规范”双管齐下的工作流建立起来。

## Spotless 插件：格式化的守门员

Spotless Maven 插件支持对多种语言进行格式化。这里选择 Google Java Format，对 Java 代码的换行、缩进和括号进行统一，避免人工调整。

```xml
<!-- Spotless 代码格式化插件 -->
<plugin>
    <groupId>com.diffplug.spotless</groupId>
    <artifactId>spotless-maven-plugin</artifactId>
    <version>2.43.0</version>
    <configuration>
        <java>
            <!-- 使用 Google Java Format -->
            <googleJavaFormat>
                <version>1.18.1</version>
                <style>GOOGLE</style>
            </googleJavaFormat>
            <!-- 移除未使用的导入 -->
            <removeUnusedImports />
            <!-- 格式化导入顺序 -->
            <importOrder>
                <order>java,javax,org,com</order>
            </importOrder>
            <!-- 删除文件尾部空白 -->
            <trimTrailingWhitespace />
            <!-- 确保文件以换行符结尾 -->
            <endWithNewline />
        </java>
    </configuration>
    <executions>
        <!-- 在 compile 阶段检查格式 -->
        <execution>
            <phase>compile</phase>
            <goals>
                <goal>check</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

**使用建议**

- 首次引入时先运行 `mvn spotless:apply`，让插件批量修正历史代码后再提交。
- 后续依赖 `mvn compile` 即可触发 `check` 目标，若格式不符合规范会直接失败。
- 将 `spotless:check` 加入 CI，可以确保所有 PR 都遵循统一风格。

## Checkstyle 插件：规范的裁判员

Checkstyle 负责更偏语义的规范，例如命名、结构、魔法数字等。下面的配置在 `validate` 阶段执行 `check` 目标，并使用自定义的规则集：

```xml
<!-- Checkstyle 代码检查插件 -->
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-checkstyle-plugin</artifactId>
    <version>3.3.1</version>
    <configuration>
        <configLocation>checkstyle/checkstyle.xml</configLocation>
        <encoding>UTF-8</encoding>
        <consoleOutput>true</consoleOutput>
        <failsOnError>true</failsOnError>
        <linkXRef>false</linkXRef>
    </configuration>
    <executions>
        <execution>
            <id>validate</id>
            <phase>validate</phase>
            <goals>
                <goal>check</goal>
            </goals>
        </execution>
    </executions>
    <dependencies>
        <dependency>
            <groupId>com.puppycrawl.tools</groupId>
            <artifactId>checkstyle</artifactId>
            <version>10.12.4</version>
        </dependency>
    </dependencies>
</plugin>
```

### 准备 Checkstyle 规则文件

在项目根目录新建 `checkstyle/checkstyle.xml` 并粘贴以下内容，即可与上面的插件配置配套使用：

```xml
<?xml version="1.0"?>
<!DOCTYPE module PUBLIC
        "-//Puppy Crawl//DTD Check Configuration 1.3//EN"
        "http://www.puppycrawl.com/dtds/configuration_1_3.dtd">

<module name="Checker">
    <property name="charset" value="UTF-8"/>
    <property name="fileExtensions" value="java"/>

    <!-- 注释掉 Header 检查，避免找不到 license-header.txt 文件 -->
    <!--
    <module name="Header">
        <property name="headerFile" value="checkstyle/license-header.txt"/>
        <property name="fileExtensions" value="java"/>
    </module>
    -->

    <module name="TreeWalker">
        <!-- 导入规范 -->
        <module name="RedundantImport"/>
        <module name="UnusedImports" />

        <!-- 注释检查 -->
        <module name="JavadocType">
            <property name="tokens" value="INTERFACE_DEF"/>
            <property name="allowUnknownTags" value="true"/>
            <property name="allowedAnnotations" value="Generated"/>
            <message key="javadoc.missing" value="类注释：缺少 Javadoc 注释。"/>
        </module>

        <!-- 命名约束 -->
        <module name="LocalFinalVariableName" />
        <module name="LocalVariableName" />
        <module name="PackageName">
            <property name="format" value="^[a-z]+(\.[a-z][a-z0-9]*)*$" />
            <message key="name.invalidPattern" value="包名 ''{0}'' 要符合 ''{1}'' 格式。"/>
        </module>
        <module name="StaticVariableName" />
        <module name="TypeName">
            <property name="severity" value="warning"/>
            <message key="name.invalidPattern" value="名称 ''{0}'' 要符合 ''{1}'' 格式。"/>
        </module>
        <module name="MemberName" />
        <module name="MethodName" />
        <module name="ParameterName" />
        <module name="ConstantName" />

        <!-- 定义规范 -->
        <module name="ArrayTypeStyle"/>
        <module name="UpperEll"/>

        <!-- 长度限制 -->
        <module name="MethodLength">
            <property name="tokens" value="METHOD_DEF" />
            <property name="max" value="500"/>
        </module>
        <module name="ParameterNumber">
            <property name="max" value="8" />
            <property name="ignoreOverriddenMethods" value="true"/>
            <property name="tokens" value="METHOD_DEF" />
        </module>

        <!-- 空格与排版 -->
        <module name="MethodParamPad" />
        <module name="TypecastParenPad" />
        <module name="NoWhitespaceAfter"/>
        <module name="NoWhitespaceBefore"/>
        <module name="ParenPad"/>
        <module name="WhitespaceAfter"/>

        <!-- 修饰符 -->
        <module name="ModifierOrder"/>
        <module name="RedundantModifier"/>

        <!-- 代码块 -->
        <module name="AvoidNestedBlocks"/>
        <module name="EmptyBlock"/>
        <module name="LeftCurly"/>
        <module name="RightCurly"/>
        <module name="NeedBraces"/>

        <!-- 语义检查 -->
        <module name="EmptyStatement"/>
        <module name="EqualsHashCode"/>
        <module name="IllegalInstantiation"/>
        <module name="MissingSwitchDefault"/>
        <module name="SimplifyBooleanExpression"/>
        <module name="SimplifyBooleanReturn"/>

        <!-- 类设计 -->
        <module name="VisibilityModifier">
            <property name="packageAllowed" value="true"/>
            <property name="protectedAllowed" value="true"/>
        </module>

        <!-- 语法安全 -->
        <module name="StringLiteralEquality"/>
        <module name="NestedForDepth">
            <property name="max" value="2"/>
        </module>
        <module name="NestedIfDepth">
            <property name="max" value="3"/>
        </module>
        <module name="UncommentedMain">
            <property name="excludedClasses" value=".*Application$"/>
        </module>
        <module name="Regexp">
            <property name="format" value="System\\.out\\.println"/>
            <property name="illegalPattern" value="true"/>
        </module>
        <module name="NestedTryDepth">
            <property name="max" value="3"/>
        </module>
        <module name="SuperClone" />
        <module name="SuperFinalize" />
    </module>
</module>
```

将上面的内容保存后，即可在本地通过 `mvn checkstyle:check` 验证。

### 常见工作流

1. ❗ 在本地提交前执行 `mvn spotless:apply checkstyle:check`，确保格式与规范全部通过。
2. 🧪 在 CI 中串联 `spotless:check` + `checkstyle:check`，双重保障代码质量。
3. 📦 对第三方分支合并时，先跑一次格式化再提交，避免 PR 中充斥无意义的空格改动。

## 写在最后

代码格式化 + 静态检查是最基础的工程化能力，却常常被视作“锦上添花”。将 Spotless 与 Checkstyle 绑定到 Maven 生命周期后，格式化与规范检查都能自动执行，为团队留下的是更高的效率、更友好的 Review 体验，以及更易维护的代码基线。
