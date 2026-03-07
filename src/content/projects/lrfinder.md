---
title: 'LRFinder for Keras'
description: 'Learning Rate Finder callback for Keras — find the optimal learning rate for your neural network training.'
tech: ['Python', 'Keras', 'TensorFlow', 'Deep Learning']
github: 'https://github.com/WittmannF/LRFinder'
featured: false
order: 4
---

# LRFinder for Keras

A Keras callback that implements the Learning Rate Finder technique, popularized by fast.ai, to automatically find the optimal learning rate for training neural networks.

## Usage

```python
from lr_finder import LRFinder

lr_finder = LRFinder(min_lr=1e-5, max_lr=1e-1)
model.fit(X_train, y_train, callbacks=[lr_finder])
lr_finder.plot_loss()
```
