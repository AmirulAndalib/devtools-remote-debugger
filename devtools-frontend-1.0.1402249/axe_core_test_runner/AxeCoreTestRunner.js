// Copyright 2019 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview using private properties isn't a Closure violation in tests.
 * @suppress {accessControls}
 */

const DEFAULT_CONFIG = {
  checks: [
    // This is a workaround for a bug in our version of axe-core
    // which does not support aria-placeholder.
    // Any attribute included in the options array will be
    // ignored by the 'aria-valid-attr' rule.
    // This should be removed after axe-core is updated.
    // See: https://github.com/dequelabs/axe-core/issues/1457
    {id: 'aria-valid-attr', options: ['aria-placeholder']}
  ]
};

AxeCoreTestRunner.processAxeResult = function(violations) {
  const result = violations.map(function(rule) {
    return {
      ruleDescription: rule.description,
      helpUrl: rule.helpUrl,
      ruleId: rule.id,
      impact: rule.impact,
      faildedNodes: AxeCoreTestRunner.processAxeResultNodesArray(rule.nodes)
    };
  });
  return JSON.stringify(result, undefined, 2);
};

AxeCoreTestRunner.processAxeResultNodesArray = function(nodes) {
  const list = nodes.map(function(node) {
    return {
      target: node.target,
      html: node.html,
    };
  });
  return list;
};

AxeCoreTestRunner.runValidation = async function(element, rules, config) {
  axe.configure(Object.assign({}, DEFAULT_CONFIG, config));

  try {
    const results = await axe.run(element, {rules});
    const violations = AxeCoreTestRunner.processAxeResult(results.violations);
    TestRunner.addResult(`aXe violations: ${violations}\n`);
  } catch (e) {
    TestRunner.addResult(`aXe threw an error: '${e}'`);
  }
};
