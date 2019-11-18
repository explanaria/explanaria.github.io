# Explanaria v0.2

![header_image](https://user-images.githubusercontent.com/1816168/36337723-37afc1bc-136b-11e8-81cb-4ce907384ad7.png)

## What is it?

Explanaria is a tool for creating animated, interactive math presentations, viewable in a web browser in full 3D. The eventual goal is to build a web app that allows anyone to create animated 3D presentations of whatever they want, and have it visible at 60fps on any web browser.

As most undergraduate students know, there are three parts of any function: the domain, the function itself, and the range. The domain is the range of values which the function can expect to be called, the range represents where the function outputs to, and the function itself does the work of transforming its inputs. Explanaria v0.1 takes the philosophy of splitting each of these three parts into their own constituent object. For example, one EXP.Area() represents a closed interval, upon which it can call an user-defined EXP.Transformation(), which is rendered by a EXP.PointOutput(). 

This tool is most definitely a work in progress.

## How do I use it?

[See here for documentation and instructions.](./DOCUMENTATION_AND_PHILOSOPHY.md)

Additionally, see [https://explanaria.github.io](https://explanaria.github.io) for several explanatory demos! View the `examples/` folder for usage and more.
