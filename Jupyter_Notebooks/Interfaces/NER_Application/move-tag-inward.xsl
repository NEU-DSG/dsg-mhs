<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:tei="http://www.tei-c.org/ns/1.0"
  xmlns:wwp="http://www.wwp.northeastern.edu/ns/textbase"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns=""
  xpath-default-namespace="http://www.tei-c.org/ns/1.0"
  exclude-result-prefixes="tei wwp xs"
  version="3.0">
  
<!--
    ...
    
    Ash Clark
    2021
  -->
  
  <xsl:output encoding="UTF-8" indent="no" method="xml" omit-xml-declaration="no"/>
  
 <!--  PARAMETERS  -->
 <!--  GLOBAL VERIABLES  -->
  
  
 <!--  IDENTITY TEMPLATES  -->
  
  <xsl:template match="*" mode="#all">
    <xsl:copy>
      <xsl:apply-templates select="@*" mode="#current"/>
      <xsl:apply-templates mode="#current"/>
    </xsl:copy>
  </xsl:template>
  
  <xsl:template match="@* | text() | comment() | processing-instruction()" mode="#all">
    <xsl:copy/>
  </xsl:template>
  
  
 <!--  TEMPLATES, #default mode  -->
  
  <!-- Put each leading processing instruction on its own line. -->
  <xsl:template match="/processing-instruction()">
    <xsl:if test="position() = 1">
      <xsl:text>&#x0A;</xsl:text>
    </xsl:if>
    <xsl:copy/>
    <xsl:text>&#x0A;</xsl:text>
  </xsl:template>
  
  <xsl:template match="/">
    <xsl:apply-templates/>
  </xsl:template>
  
  <!-- Move part 1: delete, pass on attributes to new version -->
  <xsl:template match="persRef[count(*) eq 1][normalize-space() eq normalize-space(*)]">
    <xsl:apply-templates mode="moveRef">
      <xsl:with-param name="move-attributes" select="@*" tunnel="true"/>
    </xsl:apply-templates>
  </xsl:template>
  
  
 <!--  TEMPLATES, moveRef mode  -->
  
  <!-- Move part 2: recreate wrapper element inside the element, then move back into default mode -->
  <xsl:template match="persRef/*" mode="moveRef">
    <xsl:param name="move-attributes" as="attribute()*" tunnel="true"/>
    <xsl:copy>
      <xsl:copy-of select="@*"/>
      <persRef>
        <xsl:copy-of select="$move-attributes"/>
        <xsl:apply-templates mode="#default"/>
      </persRef>
    </xsl:copy>
  </xsl:template>
  
 <!--  NAMED TEMPLATES  -->
  
 <!--  FUNCTIONS  -->
  
</xsl:stylesheet>