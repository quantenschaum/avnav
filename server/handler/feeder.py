# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2021 Andreas Vogel andreas@wellenvogel.net
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
import inspect

import serial
import socket
import os
import time

from avnserial import *
from avnav_worker import *
hasSerial=False

try:
  import avnserial
  hasSerial=True
except:
  pass


import avnav_handlerList


class NmeaEntry(object):
  def __init__(self,data,source=None,omitDecode=False,sourcePriority=NMEAParser.DEFAULT_SOURCE_PRIORITY):
    self.data=data
    self.source=source
    self.omitDecode=omitDecode
    self.sourcePriority=sourcePriority


#a Worker for feeding data trough gpsd (or directly to the navdata)
class AVNFeeder(AVNWorker):
  
  @classmethod
  def getConfigParam(cls, child=None):
    return {'maxList': 300,      #len of the input list
            'feederSleep': 0.5,  #time in s the feeder will sleep if there is no data
            'name': '',           #if there should be more then one reader we must set the name
            'decoderFilter':''   #a filter experession for the decoder
            }

  @classmethod
  def getStartupGroup(cls):
    return 1

  @classmethod
  def autoInstantiate(cls):
    return True

  def __init__(self,cfgparam):
    super().__init__(cfgparam)
    self.type=AVNWorker.Type.FEEDER
    self.listlock=threading.Condition()
    self.history=[]
    self.sequence=0
    self.readConfig()

  def readConfig(self):
    self.maxlist = self.getIntParam('maxList', True)
    self.waitTime = self.getFloatParam('feederSleep')
    filterstr = self.getStringParam('decoderFilter') or ''
    self.nmeaFilter = filterstr.split(",")

  def stop(self):
    super().stop()
    self.listlock.acquire()
    try:
      self.listlock.notifyAll()
    finally:
      self.listlock.release()



  def addNMEA(self, entry,source=None,addCheckSum=False,omitDecode=False,sourcePriority=NMEAParser.DEFAULT_SOURCE_PRIORITY):
    """
    add an NMEA record to our internal queue
    @param entry: the record
    @param source: the source where the record comes from
    @param addCheckSum: add the NMEA checksum
    @return:
    """
    if len(entry) < 5:
      AVNLog.debug("addNMEA: ignoring short data %s",entry)
      return False
    if addCheckSum:
      entry= entry.replace("\r","").replace("\n","")
      entry+= "*" + NMEAParser.nmeaChecksum(entry) + "\r\n"
    else:
      if not entry[-2:]=="\r\n":
        entry+="\r\n"
    self.listlock.acquire()
    while len(self.history) >= self.maxlist:
      self.history.pop(0)
    self.sequence+=1
    self.history.append(NmeaEntry(entry,source,omitDecode,sourcePriority))
    self.listlock.notify_all()
    self.listlock.release()
    AVNLog.debug("addNMEA history=%d data=%s",len(self.history), entry)
    return True

  def wakeUp(self):
    super().wakeUp()
    self.listlock.acquire()
    try:
      self.listlock.notifyAll()
    finally:
      self.listlock.release()

  def get_messages(self, chunk_size=10, nmea_filter=None, handler_name="feeder", timeout=1, discard_time=1):
    """yields chunks of unprocessed messages
    - chunks may be shorter than requested or emtpy
    - yield single messages if chunk_size==1
    - discards messages if not all messages have be processed within discard_time"""
    assert chunk_size>0
    seq=self.sequence # sequence id of last processed message
    t0=time.monotonic() # timestamp when pipeline was empty
    while True:
      with self.listlock:
        history,sequence=self.history,self.sequence
        start=seq+1 # first seq id of messages to yield
        end=start+chunk_size # last seq id of messages to yield, exclusive
        unprocessed=sequence-seq # number of unprocessed messages
        filled_since=time.monotonic()-t0 # time since pipeline has been emptied
        #print("unprocessed",unprocessed,"seq",(seq,sequence),f"age {filled_since:.3f}","S/E",(start,end))
        if unprocessed>len(history): # buffer overflow, too many massages
          lost=unprocessed-len(history)
          start=sequence-len(history)+1
          end=start+chunk_size
          seq=start-1
          unprocessed=sequence-seq
          AVNLog.error("%s lost %d messages", handler_name, lost)
          #print("OVERFLOW",lost)
          #print("unprocessed",unprocessed,"seq",(seq,sequence),f"age {filled_since:.3f}","S/E",(start,end))
        if filled_since>discard_time and unprocessed>chunk_size: # force empty pipeline, discard messages
          end=sequence+1 # +1 because end is exclusive
          start=max(seq+1,end-chunk_size) # yield newest messages from buffer
          discarded=start-(seq+1)
          seq=min(start-1,sequence)
          unprocessed=sequence-seq
          AVNLog.error("%s discarded %d messages", handler_name, discarded)
          #print("DISCARDED",start-(seq+1),"S/E",(start,end))
          #print("unprocessed",unprocessed,"seq",(seq,sequence),f"age {filled_since:.3f}","S/E",(start,end))
        o=sequence-len(history)+1 # offset=sequence-array_index
        start,end=start-o,end-o # seq --> history index
        end=min(end,len(history)) # limit chunk to available data
        assert start<=end and 0<=start<=len(history) and 0<=end<=len(history), (start,end,len(history))
        messages=history[start:end]
        seq+=len(messages)
        assert seq<=sequence,(seq,sequence)
        empty=end==len(history) # pipeline is empty now
        if not messages: # wait for new messages
          self.listlock.wait(timeout)
        if empty:
          t0=time.monotonic() # reset time after waiting, it has been empty until now
        if self.sequence>sequence: # new messages are available now
          assert not messages
          continue
        #print("yield",len(messages),"remaining",len(history)-end)
      assert len(messages)<=chunk_size
      # filtering should better happen outside in the handler itself
      messages=list(filter(lambda m:NMEAParser.checkFilter(m.data,nmea_filter), messages))
      yield messages if chunk_size>1 else messages[0] if messages else None

  def fetchFromHistory(self,sequence,maxEntries=10,includeSource=False,waitTime=0.1,nmeafilter=None,returnError=False):
    "wrapper for get_messages for compatibility, initialize with sequence 0"
    seq=sequence or self.get_messages(chunk_size=maxEntries, timeout=waitTime, nmea_filter=nmeafilter,
                                      handler_name=inspect.stack()[1].filename.split("/")[-1].replace(".py",""))
    try:
      messages=seq.__next__()
    except StopIteration:
      messages=[]
    return (0, seq, messages) if returnError else (seq, messages) # errors are logged in get_messages

  def run(self):
    AVNLog.info("standalone feeder started")
    nmeaParser=NMEAParser(self.navdata)
    self.setInfo('main', "running", WorkerStatus.RUNNING)
    while not self.shouldStop():
      try:
        for chunk in self.get_messages(nmea_filter=self.nmeaFilter,handler_name="decoder"):
          if self.shouldStop(): break
          self.setInfo('main',"feeding NMEA", WorkerStatus.NMEA)
          for msg in chunk:
            if not msg is None and not msg.omitDecode:
              nmeaParser.parseData(msg.data,source=msg.source,sourcePriority=msg.sourcePriority)
      except Exception as e:
        AVNLog.warn("feeder exception - retrying %s",traceback.format_exc())


class AVNGpsdFeeder(AVNFeeder):
  '''
  legacy config support with AVNGpsdFeeder
  '''

  @classmethod
  def autoInstantiate(cls):
    return False


avnav_handlerList.registerHandler(AVNGpsdFeeder)
avnav_handlerList.registerHandler(AVNFeeder)
