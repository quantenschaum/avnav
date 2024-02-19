# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2013 Andreas Vogel andreas@wellenvogel.net
#
#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
#
#  parts from this software (AIS decoding) are taken from the gpsd project
#  so refer to this BSD licencse also (see ais.py) or omit ais.py 
###############################################################################
import socket
import re

from avnav_nmea import *
from avnav_worker import *

  

#a base class for socket readers and writers

class SocketReader(object):
  P_STRIP_LEADING = WorkerParameter('stripLeading', False, type=WorkerParameter.T_BOOLEAN,
                                description="strip anything before $ or ! in received lines")
  START_PATTERN=re.compile('[$!]')
  def __init__(self,socket,writeData,queue,setInfo,shouldStop=None,sourcePriority=NMEAParser.DEFAULT_SOURCE_PRIORITY,stripLeading=False):
    self.feeder=None
    self.writeData=writeData
    self.feeder=queue
    self.socket=socket
    self.stopFlag=False
    self.setInfo=setInfo
    self.shouldStop=shouldStop if shouldStop is not None else self.shouldStopInternal
    self.sourcePriority=sourcePriority
    self.stripLeading=stripLeading


  def shouldStopInternal(self):
    return self.stopFlag
  def stop(self):
    self.stopFlag=True
    try:
      self.socket.shutdown(socket.SHUT_RDWR)
    except:
      pass
    self.socket.close()

  def _removeLeading(self,line):
    if not self.stripLeading:
      return line
    if line is None:
      return line
    match=self.START_PATTERN.search(line)
    if match is None:
      return line
    return line[match.span()[0]:]

  def readSocket(self,infoName,sourceName,filter=None,timeout=None):
    sock=self.socket
    filterA = None
    if filter:
      filterA = filter.split(',')
    pattern=AVNUtil.getNMEACheck()
    peer = "unknown connection"
    try:
      peer="%s:%d"%sock.getsockname()
      peer+="-%s:%d"%sock.getpeername()
    except:
      pass
    AVNLog.info("%s established, start reading",peer)
    self.setInfo(infoName, "receiving %s"%(peer,), WorkerStatus.RUNNING)
    buffer=""
    hasNMEA=False
    try:
      sock.settimeout(1)
      lastReceived=time.time()
      while sock.fileno() >= 0 and not self.shouldStop():
        try:
          data = sock.recv(1024)
          lastReceived=time.time()
        except socket.timeout:
          if timeout is not None:
            now=time.time()
            if now < lastReceived:
              lastReceived=now
              continue
            if now > (lastReceived + timeout):
              raise Exception("no data received within timeout of %s seconds"%str(timeout))
          continue
        if len(data) == 0:
          AVNLog.info("connection lost")
          break
        buffer=buffer+data.decode('ascii','ignore')
        lines=buffer.splitlines(True)
        if lines[-1][-1]=='\n':
          #last one ends with nl
          for l in lines:
            l=l.translate(NMEAParser.STRIPCHARS)
            l=self._removeLeading(l)
            if pattern.match(l):
              if not NMEAParser.checkFilter(l, filterA):
                continue
              self.writeData(l,source=sourceName,sourcePriority=self.sourcePriority)
              if not hasNMEA:
                self.setInfo(infoName, "NMEA %s"%(peer,), WorkerStatus.NMEA)
                hasNMEA=True
            else:
              AVNLog.debug("ignoring unknown data %s",l)
          buffer=''
        else:
          for i in range(len(lines)-1):
            line=lines[i].translate(NMEAParser.STRIPCHARS)
            line=self._removeLeading(line)
            if pattern.match(line):
              self.writeData(line,source=sourceName,sourcePriority=self.sourcePriority)
              if not hasNMEA:
                self.setInfo(infoName, "NMEA %s"%peer, WorkerStatus.NMEA)
                hasNMEA=True
            else:
              AVNLog.debug("ignoring unknown data %s",lines[i])
          if len(lines) > 0:
            buffer=lines[-1]
        if len(buffer) > 4096:
          AVNLog.debug("no line feed in long data, stopping")
          break
      sock.shutdown(socket.SHUT_RDWR)
      sock.close()
    except Exception as e:
      AVNLog.error("exception while reading from socket: %s",traceback.format_exc())
      pass
    try:
      self.stop()
    except:
      pass
    AVNLog.info("disconnected from socket %s",peer)
    self.setInfo(infoName, "socket to %s disconnected"%(peer), WorkerStatus.ERROR)

  def writeSocket(self,infoName,filterstr,version,blacklist):
    '''
    write method
    there is no stop handling so the socket must be closed from another thread
    '''
    filter = None
    if filterstr != "":
      filter = filterstr.split(',')
    self.setInfo(infoName, "sending data", WorkerStatus.RUNNING)
    try:
      self.socket.sendall(("avnav_server %s\r\n" % (version)).encode('utf-8'))
      for chunk in self.feeder.get_messages(handler_name=infoName, nmea_filter=filter):
        if self.socket.fileno() < 0: break
        sent = False
        for msg in chunk:
          if msg.source in blacklist:
            AVNLog.debug("ignore %s:%s due to blacklist", msg.source, msg.data)
          else:
            print(">",msg.data.strip())
            self.socket.sendall(msg.data.encode('ascii', errors='ignore'))
            sent = True
        if not sent:
          # just throw an exception if the reader potentially closed the socket
          self.socket.getpeername()
    except Exception as e:
      AVNLog.info("exception in client connection %s", traceback.format_exc())
    AVNLog.info("client disconnected or stop received")
    try:
      self.stop()
    except Exception as e:
      AVNLog.error("error closing socket %s", str(e))

 