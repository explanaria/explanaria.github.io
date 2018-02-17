# Explanaria v0.1

![header_image](https://user-images.githubusercontent.com/1816168/36337723-37afc1bc-136b-11e8-81cb-4ce907384ad7.png)

## What is it?

Explanaria is a tool for creating animated math presentations, called explanarians. The eventual goal is to build a web app that allows anyone to create animated 3D presentations of whatever they want, and have it visible at 60fps on any web browser.

As most undergraduate students know, there are three parts of any function: the domain, the function itself, and the range. The domain is the range of values which the function can expect to be called, the range represents where the function outputs to, and the function itself does the work of transforming its inputs. Explanaria v0.1 takes the philosophy of splitting each of these three parts into their own constituent object. For example, one Area() represents a closed interval, upon which it call an user-defined Transformation(), which is rendered by a PointOutput(). 

This tool is most definitely a work in progress.

## How do I use it?

See [https://zsteinberg.github.io/explanaria](https://zsteinberg.github.io/explanaria) for a demo, and view the `examples/` folder for usage and more. You're better off looking at the examples than at any formal documentation right now.

If you want, you can also create high-quality videos of a created explanarian. Just run a local webserver with `node index.js`. Then, change any `new Threeasy_Setup()` to `new Threeasy_Recorder()`, and the program will automatically render a series of png images, which can be compiled (for example, with `ffmpeg`) into a smooth mp4.
